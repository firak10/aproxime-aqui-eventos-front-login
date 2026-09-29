// Configurações Globais
const API_BASE_URL = "https://aproxime-aqui-eventos-api.onrender.com";

// SUPABASE STORAGE
const SUPABASE_URL = "https://bosjqefiyodvzjqevfbj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Y-k0XJz0MLAuVJjOWQy5ng_m2GqZR3G";
const supabaseClient = typeof supabase !== 'undefined' ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Variáveis de Estado
let globalUsers = [];
let globalEvents = [];
let globalParticipants = [];
let companiesList = [];
let userFormMode = "create"; // 'create' | 'edit'
let eventFormMode = "create"; // 'create' | 'edit'

// Formatador Auxiliar de Data (DD/MM/AAAA)
function formatDateOnly(dateString) {
    if (!dateString) return 'Sem data';
    const rawDate = dateString.split('T')[0];
    const parts = rawDate.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return rawDate;
}

// Helper Headers Autorizados
function getAuthHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("aproxime_token")}`
    };
}

// Logout Global
function handleLogout() {
    localStorage.clear();
    window.location.href = "/index.html";
}

// =========================================================================
// 1. LOGIN (index.html)
// =========================================================================
function togglePassword() {
    const passInput = document.getElementById("password");
    const eyeIcon = document.getElementById("eyeIcon");
    if (!passInput || !eyeIcon) return;

    if (passInput.type === "password") {
        passInput.type = "text";
        eyeIcon.classList.remove("fa-eye");
        eyeIcon.classList.add("fa-eye-slash");
    } else {
        passInput.type = "password";
        eyeIcon.classList.remove("fa-eye-slash");
        eyeIcon.classList.add("fa-eye");
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("errorMessage");
    const errorText = document.getElementById("errorText");
    const btnSubmit = document.getElementById("btnSubmit");

    errorMessage.classList.add("hidden");
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Autenticando...</span>`;

    try {
        const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Falha na autenticação.");
        }

        localStorage.setItem("aproxime_token", data.access_token);
        localStorage.setItem("aproxime_role", data.role);
        localStorage.setItem("aproxime_company_id", data.company_id || "");
        localStorage.setItem("aproxime_company_name", data.company_name || "");

        if (data.role === "superadmin") {
            window.location.href = "/superadmineventos.html";
        } else if (data.role === "admin") {
            window.location.href = "/dashboard.html";
        } else {
            throw new Error("Perfil de acesso não reconhecido.");
        }

    } catch (err) {
        errorText.innerText = err.message;
        errorMessage.classList.remove("hidden");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<span>Acessar Painel</span> <i class="fa-solid fa-arrow-right text-xs"></i>`;
    }
}

// =========================================================================
// 2. DASHBOARD DO CLIENTE (dashboard.html)
// =========================================================================

function initDashboard() {
    const token = localStorage.getItem("aproxime_token");
    const companyName = localStorage.getItem("aproxime_company_name");

    if (!token) {
        window.location.href = "/index.html";
        return;
    }

    if (companyName && document.getElementById("companyTitle")) {
        document.getElementById("companyTitle").innerText = companyName;
    }

    loadUsers();
    loadEvents();
}

function switchTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));

    document.getElementById(tabId).classList.remove("hidden");
    if (tabId === 'tab1') document.getElementById("btnTab1").classList.add("active");
    if (tabId === 'tab2') document.getElementById("btnTab2").classList.add("active");
    if (tabId === 'tab3') document.getElementById("btnTab3").classList.add("active");
}

// ABA 1: PESSOAS / USUÁRIOS
async function loadUsers() {
    try {
        const res = await fetch(`${API_BASE_URL}/v1/admin/users`, { headers: getAuthHeaders() });
        globalUsers = await res.json();
        filterUserTable();
        renderUsersChecklist(globalUsers);
        renderUserSelectForEdit(globalUsers);
    } catch (err) {
        console.error("Erro ao carregar usuários:", err);
    }
}

function switchUserFormMode(mode) {
    userFormMode = mode;
    const containerSelect = document.getElementById("userSelectContainer");
    const btnCreate = document.getElementById("btnUserModeCreate");
    const btnEdit = document.getElementById("btnUserModeEdit");
    const lblSave = document.getElementById("lblSaveUser");

    if (mode === 'create') {
        btnCreate.classList.add("active");
        btnEdit.classList.remove("active");
        containerSelect.classList.add("hidden");
        lblSave.innerText = "Salvar Pessoa";
        document.getElementById("userForm").reset();
    } else {
        btnEdit.classList.add("active");
        btnCreate.classList.remove("active");
        containerSelect.classList.remove("hidden");
        lblSave.innerText = "Atualizar Dados da Pessoa";
        onSelectUserToEdit();
    }
}

function filterUserEditOptions() {
    const searchTerm = (document.getElementById("inputFilterUserEdit").value || "").toLowerCase().trim();
    const filtered = globalUsers.filter(u => {
        const nameMatch = u.name ? u.name.toLowerCase().includes(searchTerm) : false;
        const docMatch = u.document ? u.document.toLowerCase().includes(searchTerm) : false;
        const codeMatch = u.code ? u.code.toLowerCase().includes(searchTerm) : false;
        return nameMatch || docMatch || codeMatch;
    });
    renderUserSelectForEdit(filtered);
}

function renderUserSelectForEdit(users) {
    const select = document.getElementById("selectEditUser");
    if (!select) return;
    if (!users || users.length === 0) {
        select.innerHTML = `<option value="">-- Nenhuma pessoa encontrada --</option>`;
        return;
    }
    select.innerHTML = `<option value="">-- Selecione uma pessoa --</option>` +
        users.map(u => `<option value="${u.id}">${u.name} (${u.document || u.code || 'Sem doc'})</option>`).join("");
}

function onSelectUserToEdit() {
    const userId = document.getElementById("selectEditUser").value;
    if (!userId) {
        document.getElementById("userName").value = "";
        document.getElementById("userDocument").value = "";
        document.getElementById("userCode").value = "";
        return;
    }

    const user = globalUsers.find(u => u.id === userId);
    if (user) {
        document.getElementById("userName").value = user.name || "";
        document.getElementById("userDocument").value = user.document || "";
        document.getElementById("userCode").value = user.code || "";
    }
}

function filterUserTable() {
    const searchTerm = (document.getElementById("inputSearchUserTable").value || "").toLowerCase().trim();
    const statusFilter = document.getElementById("selectStatusUserTable").value;

    const filtered = globalUsers.filter(u => {
        const nameMatch = u.name ? u.name.toLowerCase().includes(searchTerm) : false;
        const docMatch = u.document ? u.document.toLowerCase().includes(searchTerm) : false;
        const codeMatch = u.code ? u.code.toLowerCase().includes(searchTerm) : false;
        const matchesSearch = nameMatch || docMatch || codeMatch;

        let matchesStatus = true;
        if (statusFilter === "active") matchesStatus = u.active === true;
        if (statusFilter === "inactive") matchesStatus = u.active === false;

        return matchesSearch && matchesStatus;
    });

    renderUsersTable(filtered);
}

function renderUsersTable(users) {
    const tbody = document.getElementById("usersTableBody");
    if (!tbody) return;
    if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500">Nenhuma pessoa encontrada.</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => `
        <tr class="hover:bg-slate-800/30 transition">
            <td class="py-3 px-4 font-semibold text-white flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700">
                    ${u.photo_url ? `<img src="${u.photo_url}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-user text-slate-500 text-xs"></i>`}
                </div>
                <span>${u.name}</span>
            </td>
            <td class="py-3 px-4 font-mono text-slate-400">${u.document || u.code || '--'}</td>
            <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                    <span class="font-mono text-indigo-300 text-[11px] bg-slate-900 border border-slate-800 px-2 py-1 rounded select-all" title="Clique para selecionar e copiar">${u.tag_uid || 'Sem Hash'}</span>
                    <button onclick="generateAndAssignUID('${u.id}')" title="Gerar nova Hash aleatória para NDEF" class="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 rounded border border-indigo-500/30 transition text-[10px] flex items-center gap-1">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        <span>Gerar Hash</span>
                    </button>
                </div>
            </td>
            <td class="py-3 px-4">
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${u.active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}">
                    ${u.active ? 'Habilitado' : 'Desabilitado'}
                </span>
            </td>
            <td class="py-3 px-4 text-right flex items-center justify-end gap-2">
                <button onclick="prepareUserEdit('${u.id}')" class="text-slate-400 hover:text-indigo-400 p-1.5 transition" title="Editar">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button onclick="toggleUserGlobalStatus('${u.id}', ${!u.active})" class="text-slate-400 hover:text-rose-400 p-1.5 transition" title="Habilitar/Desabilitar">
                    <i class="fa-solid fa-power-off"></i>
                </button>
            </td>
        </tr>
    `).join("");
}

function prepareUserEdit(userId) {
    switchUserFormMode('edit');
    document.getElementById("selectEditUser").value = userId;
    onSelectUserToEdit();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function generateRandomTagUID() {
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function generateAndAssignUID(userId) {
    const newUID = generateRandomTagUID();

    if (!confirm(`Gerar novo UID/Hash para esta pessoa?\n\nNovo Hash: ${newUID}\n\nEste é o código que deverá ser gravado no NDEF da TAG.`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/v1/admin/users/${userId}/uid`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ tag_uid: newUID })
        });

        if (res.ok) {
            loadUsers();
        } else {
            alert("Erro ao salvar o UID no servidor.");
        }
    } catch (err) {
        alert("Erro de conexão ao vincular UID.");
    }
}

async function toggleUserGlobalStatus(userId, newActiveStatus) {
    try {
        await fetch(`${API_BASE_URL}/v1/admin/users/${userId}/status`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ active: newActiveStatus })
        });
        loadUsers();
    } catch (err) {
        alert("Erro ao alterar status do usuário.");
    }
}

async function uploadPhotoToSupabase(file) {
    if (!file || !supabaseClient) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `users/${fileName}`;

    const { data, error } = await supabaseClient.storage
        .from('avatars')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
        });

    if (error) {
        console.error("Erro no upload do Supabase Storage:", error);
        throw new Error(`Falha ao enviar a foto do participante: ${error.message}`);
    }

    const { data: publicUrlData } = supabaseClient.storage
        .from('avatars')
        .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
}

async function handleSaveUser(e) {
    e.preventDefault();

    const btn = document.getElementById("btnSaveUser");
    const photoFileInput = document.getElementById("userPhotoFile");
    const selectedFile = photoFileInput.files[0];

    if (userFormMode === 'edit' && !document.getElementById("selectEditUser").value) {
        alert("Selecione uma pessoa para editar.");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Processando...`;

    try {
        let uploadedPhotoUrl = null;

        if (selectedFile) {
            uploadedPhotoUrl = await uploadPhotoToSupabase(selectedFile);
        }

        const payload = {
            name: document.getElementById("userName").value.trim(),
            document: document.getElementById("userDocument").value.trim() || null,
            code: document.getElementById("userCode").value.trim() || null,
            photo_url: uploadedPhotoUrl
        };

        let res;
        if (userFormMode === 'create') {
            res = await fetch(`${API_BASE_URL}/v1/admin/users`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
        } else {
            const userId = document.getElementById("selectEditUser").value;
            res = await fetch(`${API_BASE_URL}/v1/admin/users/${userId}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
        }

        if (res.ok) {
            alert(userFormMode === 'create' ? "Pessoa cadastrada com sucesso!" : "Dados da pessoa atualizados com sucesso!");
            document.getElementById("userForm").reset();
            if (userFormMode === 'edit') switchUserFormMode('create');
            loadUsers();
        } else {
            const errData = await res.json();
            alert(errData.detail || "Erro ao salvar pessoa.");
        }
    } catch (err) {
        alert(err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> <span>${document.getElementById("lblSaveUser").innerText}</span>`;
    }
}

// ABA 2: EVENTOS
async function loadEvents() {
    try {
        const res = await fetch(`${API_BASE_URL}/v1/admin/events`, { headers: getAuthHeaders() });
        globalEvents = await res.json();
        renderEventsSelect(globalEvents);
        renderEditEventsSelect(globalEvents);
    } catch (err) {
        console.error("Erro ao carregar eventos:", err);
    }
}

function switchEventFormMode(mode) {
    eventFormMode = mode;
    const containerSelect = document.getElementById("eventSelectContainer");
    const containerChecklist = document.getElementById("eventChecklistContainer");
    const btnCreate = document.getElementById("btnEventModeCreate");
    const btnEdit = document.getElementById("btnEventModeEdit");
    const lblSave = document.getElementById("lblSaveEvent");

    if (mode === 'create') {
        btnCreate.classList.add("active");
        btnEdit.classList.remove("active");
        containerSelect.classList.add("hidden");
        containerChecklist.classList.remove("hidden");
        lblSave.innerText = "Salvar e Criar Evento";
        document.getElementById("eventForm").reset();
    } else {
        btnEdit.classList.add("active");
        btnCreate.classList.remove("active");
        containerSelect.classList.remove("hidden");
        containerChecklist.classList.add("hidden");
        lblSave.innerText = "Atualizar Evento";
        onSelectEventToEdit();
    }
}

function renderEditEventsSelect(events) {
    const select = document.getElementById("selectEditEvent");
    if (!select) return;
    if (!events || events.length === 0) {
        select.innerHTML = `<option value="">-- Nenhum evento cadastrado --</option>`;
        return;
    }
    select.innerHTML = `<option value="">-- Selecione um evento --</option>` +
        events.map(e => `<option value="${e.id}">${e.title} (${formatDateOnly(e.event_date)})</option>`).join("");
}

function onSelectEventToEdit() {
    const eventId = document.getElementById("selectEditEvent").value;
    if (!eventId) {
        document.getElementById("eventTitle").value = "";
        document.getElementById("eventDate").value = "";
        document.getElementById("eventDescription").value = "";
        return;
    }

    const evt = globalEvents.find(e => e.id === eventId);
    if (evt) {
        document.getElementById("eventTitle").value = evt.title || "";
        document.getElementById("eventDate").value = evt.event_date ? evt.event_date.split('T')[0] : "";
        document.getElementById("eventDescription").value = evt.description || "";
    }
}

function renderEventsSelect(events) {
    const select = document.getElementById("selectManageEvent");
    if (!select) return;
    if (!events || events.length === 0) {
        select.innerHTML = `<option value="">-- Nenhum Evento Encontrado --</option>`;
        return;
    }

    let options = `<option value="">-- Selecione um Evento --</option>`;
    options += events.map(e => `<option value="${e.id}">${e.title} (${formatDateOnly(e.event_date)})</option>`).join("");
    select.innerHTML = options;
}

function renderUsersChecklist(users) {
    const container = document.getElementById("eventUsersChecklist");
    if (!container) return;
    if (!users || users.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-500">Cadastre pessoas na Aba 1 primeiro.</p>`;
        return;
    }
    container.innerHTML = users.map(u => `
        <label class="flex items-center gap-2 text-xs text-slate-300 hover:bg-slate-800/40 p-1.5 rounded cursor-pointer">
            <input type="checkbox" value="${u.id}" class="user-event-checkbox rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0">
            <span>${u.name} (${u.document || u.code || 'Sem doc'})</span>
        </label>
    `).join("");
}

function toggleSelectAllUsers() {
    const checkboxes = document.querySelectorAll(".user-event-checkbox");
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
}

async function handleSaveEvent(e) {
    e.preventDefault();

    if (eventFormMode === 'edit' && !document.getElementById("selectEditEvent").value) {
        alert("Selecione um evento para editar.");
        return;
    }

    const rawDate = document.getElementById("eventDate").value;

    try {
        let res;
        if (eventFormMode === 'create') {
            const selectedUserIds = Array.from(document.querySelectorAll(".user-event-checkbox:checked")).map(cb => cb.value);
            const payload = {
                title: document.getElementById("eventTitle").value.trim(),
                event_date: rawDate,
                description: document.getElementById("eventDescription").value.trim() || null,
                user_ids: selectedUserIds
            };
            res = await fetch(`${API_BASE_URL}/v1/admin/events`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
        } else {
            const eventId = document.getElementById("selectEditEvent").value;
            const payload = {
                title: document.getElementById("eventTitle").value.trim(),
                event_date: rawDate,
                description: document.getElementById("eventDescription").value.trim() || null
            };
            res = await fetch(`${API_BASE_URL}/v1/admin/events/${eventId}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
        }

        if (res.ok) {
            alert(eventFormMode === 'create' ? "Evento criado com sucesso!" : "Evento atualizado com sucesso!");
            document.getElementById("eventForm").reset();
            if (eventFormMode === 'edit') switchEventFormMode('create');
            await loadEvents();
            switchTab("tab3");
        } else {
            const errData = await res.json();
            alert(`Erro ao salvar evento: ${JSON.stringify(errData.detail || errData)}`);
        }
    } catch (err) {
        alert("Erro de conexão ao salvar evento.");
    }
}

// ABA 3: GESTÃO DO EVENTO
async function loadEventParticipants() {
    const eventId = document.getElementById("selectManageEvent").value;
    const tbody = document.getElementById("participantsTableBody");

    if (!eventId) {
        globalParticipants = [];
        tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-slate-500">Selecione um evento acima para gerenciar os acessos.</td></tr>`;
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/v1/admin/events/${eventId}/participants`, { headers: getAuthHeaders() });
        globalParticipants = await res.json();
        filterParticipants();
    } catch (err) {
        console.error("Erro ao carregar participantes:", err);
    }
}

function filterParticipants() {
    const searchTerm = document.getElementById("inputSearchParticipant").value.toLowerCase().trim();
    const eventId = document.getElementById("selectManageEvent").value;

    if (!eventId) return;

    const filtered = globalParticipants.filter(p => {
        const nameMatch = p.name ? p.name.toLowerCase().includes(searchTerm) : false;
        const docMatch = p.document ? p.document.toLowerCase().includes(searchTerm) : false;
        const codeMatch = p.code ? p.code.toLowerCase().includes(searchTerm) : false;
        return nameMatch || docMatch || codeMatch;
    });

    renderParticipantsTable(filtered, eventId);
}

function renderParticipantsTable(participants, eventId) {
    const tbody = document.getElementById("participantsTableBody");
    if (!tbody) return;

    if (!participants || participants.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-slate-500">Nenhum usuário encontrado para este evento.</td></tr>`;
        return;
    }

    tbody.innerHTML = participants.map(p => `
        <tr class="hover:bg-slate-800/30 transition">
            <td class="py-3 px-4 font-semibold text-white flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700">
                    ${p.photo_url ? `<img src="${p.photo_url}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-user text-slate-500 text-xs"></i>`}
                </div>
                <span>${p.name}</span>
            </td>
            <td class="py-3 px-4 font-mono text-slate-400">${p.document || p.code || '--'}</td>
            <td class="py-3 px-4 font-mono text-indigo-300 text-[11px]">${p.tag_uid || 'Sem Hash'}</td>
            <td class="py-3 px-4 text-center">
                <button onclick="toggleEventParticipant('${eventId}', '${p.user_id}', ${!p.enabled_in_event})" 
                    class="px-3 py-1 rounded-full text-[10px] font-semibold border transition ${p.enabled_in_event ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'}">
                    ${p.enabled_in_event ? '<i class="fa-solid fa-circle-check"></i> Habilitado no Evento' : '<i class="fa-solid fa-circle-xmark"></i> Desabilitado no Evento'}
                </button>
            </td>
        </tr>
    `).join("");
}

async function toggleEventParticipant(eventId, userId, newStatus) {
    try {
        const res = await fetch(`${API_BASE_URL}/v1/admin/events/${eventId}/participants/${userId}`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ enabled_in_event: newStatus })
        });

        if (res.ok) {
            const item = globalParticipants.find(p => p.user_id === userId);
            if (item) item.enabled_in_event = newStatus;
            filterParticipants();
        } else {
            alert("Erro ao alterar acesso do participante.");
        }
    } catch (err) {
        alert("Erro de conexão ao alterar acesso.");
    }
}

// =========================================================================
// 3. PAINEL SUPERADMIN (superadmineventos.html)
// =========================================================================

let companyFormMode = "create"; // 'create' | 'edit'

function renderCompanies(list) {
    const tbody = document.getElementById("companiesTableBody");
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-slate-500">Nenhuma empresa encontrada.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = list.map(c => `
        <tr class="hover:bg-slate-800/30 transition">
            <td class="py-3 px-4 font-semibold text-white">${c.name}</td>
            <td class="py-3 px-4 font-mono text-indigo-300 text-[11px]">${c.email || '--'}</td>
            <td class="py-3 px-4 font-mono text-slate-400">${c.document || '--'}</td>
            <td class="py-3 px-4">
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}">
                    <span class="w-1.5 h-1.5 rounded-full ${c.active ? 'bg-emerald-400' : 'bg-rose-400'}"></span>
                    ${c.active ? 'Ativa' : 'Inativa'}
                </span>
            </td>
            <td class="py-3 px-4 text-right flex items-center justify-end gap-2">
                <button onclick="editCompany('${c.id}')" class="text-slate-400 hover:text-indigo-400 p-1.5 transition" title="Editar Empresa">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button onclick="toggleCompanyStatus('${c.id}', ${!c.active})" class="text-slate-400 hover:text-rose-400 p-1.5 transition" title="Alternar Status">
                    <i class="fa-solid fa-power-off"></i>
                </button>
            </td>
        </tr>
    `).join("");
}

function openCompanyModal(mode = "create") {
    companyFormMode = mode;
    const titleEl = document.getElementById("companyModalTitle");
    const btnText = document.getElementById("btnSaveCompanyText");
    const pwdLabel = document.getElementById("lblCompanyPassword");
    const pwdInput = document.getElementById("companyPassword");

    if (mode === "create") {
        titleEl.innerHTML = `<i class="fa-solid fa-building-circle-check text-indigo-400"></i> Cadastrar Nova Empresa`;
        btnText.innerText = "Salvar Empresa";
        pwdLabel.innerText = "Senha de Acesso *";
        pwdInput.required = true;
        pwdInput.placeholder = "Defina a senha de login da empresa";
        document.getElementById("companyForm").reset();
        document.getElementById("companyId").value = "";
    } else {
        titleEl.innerHTML = `<i class="fa-solid fa-building-circle-gear text-indigo-400"></i> Editar Empresa`;
        btnText.innerText = "Atualizar Empresa";
        pwdLabel.innerText = "Nova Senha (deixe em branco para manter a atual)";
        pwdInput.required = false;
        pwdInput.placeholder = "Preencha apenas se quiser alterar a senha";
    }

    document.getElementById("companyModal").classList.remove("hidden");
}

function editCompany(companyId) {
    const company = companiesList.find(c => c.id === companyId || String(c.id) === String(companyId));
    if (!company) return;

    openCompanyModal("edit");
    document.getElementById("companyId").value = company.id;
    document.getElementById("companyName").value = company.name || "";
    document.getElementById("companyEmail").value = company.email || "";
    document.getElementById("companyDocument").value = company.document || "";
    document.getElementById("companyPassword").value = "";
}

function closeCompanyModal() {
    document.getElementById("companyModal").classList.add("hidden");
    document.getElementById("companyForm").reset();
    document.getElementById("companyId").value = "";
}

async function handleSaveCompany(event) {
    event.preventDefault();

    const token = localStorage.getItem("aproxime_token");
    const btn = document.getElementById("btnSaveCompany");
    const companyId = document.getElementById("companyId").value;
    const passwordValue = document.getElementById("companyPassword").value;

    const payload = {
        name: document.getElementById("companyName").value.trim(),
        email: document.getElementById("companyEmail").value.trim(),
        document: document.getElementById("companyDocument").value.trim() || null
    };

    if (passwordValue) {
        payload.password = passwordValue;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Processando...`;

    try {
        const url = companyFormMode === "create"
            ? `${API_BASE_URL}/v1/superadmin/companies`
            : `${API_BASE_URL}/v1/superadmin/companies/${companyId}`;

        const method = companyFormMode === "create" ? "POST" : "PUT";

        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Erro ao salvar empresa.");
        }

        closeCompanyModal();
        fetchCompanies();

    } catch (err) {
        alert(err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span id="btnSaveCompanyText">${companyFormMode === 'create' ? 'Salvar Empresa' : 'Atualizar Empresa'}</span>`;
    }
}

async function toggleCompanyStatus(companyId, newActiveStatus) {
    const token = localStorage.getItem("aproxime_token");

    try {
        const response = await fetch(`${API_BASE_URL}/v1/superadmin/companies/${companyId}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ active: newActiveStatus })
        });

        if (response.ok) {
            fetchCompanies();
        } else {
            alert("Erro ao alterar o status da empresa.");
        }
    } catch (err) {
        alert("Erro de conexão ao alterar status da empresa.");
    }
}


// =========================================================================
// INICIALIZAÇÃO E AUXILIARES DO SUPERADMIN
// =========================================================================

async function initSuperAdmin() {
    const token = localStorage.getItem("aproxime_token");
    const role = localStorage.getItem("aproxime_role");

    if (!token || role !== "superadmin") {
        window.location.href = "/index.html";
        return;
    }

    await fetchCompanies();
}

async function fetchCompanies() {
    const token = localStorage.getItem("aproxime_token");

    try {
        const response = await fetch(`${API_BASE_URL}/v1/superadmin/companies`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                window.location.href = "/index.html";
                return;
            }
            throw new Error("Erro ao buscar empresas.");
        }

        companiesList = await response.json();
        
        // Atualiza contadores do topo
        const totalCompaniesEl = document.getElementById("totalCompanies");
        if (totalCompaniesEl) {
            totalCompaniesEl.innerText = companiesList.length;
        }

        renderCompanies(companiesList);
    } catch (err) {
        console.error("Erro ao carregar lista de empresas:", err);
    }
}

function filterCompanies() {
    const input = document.getElementById("searchInput");
    if (!input) return;

    const term = input.value.toLowerCase().trim();
    const filtered = companiesList.filter(c => {
        const nameMatch = c.name ? c.name.toLowerCase().includes(term) : false;
        const emailMatch = c.email ? c.email.toLowerCase().includes(term) : false;
        const docMatch = c.document ? c.document.toLowerCase().includes(term) : false;
        return nameMatch || emailMatch || docMatch;
    });

    renderCompanies(filtered);
}

function generateRandomPassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 10; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const pwdInput = document.getElementById("companyPassword");
    if (pwdInput) {
        pwdInput.value = password;
        pwdInput.type = "text"; // Exibe temporariamente para facilitar cópia se necessário
    }
}