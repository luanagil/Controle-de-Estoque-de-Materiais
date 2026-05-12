// ===============================
// CONFIGURAÇÃO FIREBASE
// ===============================
const firebaseConfig = {
    apiKey: "AIzaSyDMjiVysurdN0WbPK4Ff267x-SNw8CbHJI",
    authDomain: "estoque-hidr.firebaseapp.com",
    databaseURL: "https://estoque-hidr-default-rtdb.firebaseio.com",
    projectId: "estoque-hidr",
    storageBucket: "estoque-hidr.appspot.com",
    messagingSenderId: "254874811520",
    appId: "1:254874811520:web:8deaaefd730818355d7a65",
    measurementId: "G-Q3W52YTFXB"
};

// Inicialização segura
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const database = firebase.database();

// Variáveis de Controle
let editKey = null;
let inventoryData = []; 
let currentSort = { field: 'name', asc: true };

// Configurações de Paginação
let currentPage = 1;
const itemsPerPage = 10;

// ===============================
// ELEMENTOS HTML
// ===============================
const body = document.body;
const loginSection = document.getElementById('login-section');
const inventorySection = document.getElementById('inventory-section');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const loginErrorMessage = document.getElementById('login-error-message');

const itemNameInput = document.getElementById('item-name');
const itemCategoryInput = document.getElementById('item-category'); 
const itemUnitInput = document.getElementById('item-unit'); 
const itemCurrentInput = document.getElementById('item-current'); 
const itemMinimumInput = document.getElementById('item-minimum'); 
const itemShelfInput = document.getElementById('item-shelf'); 
const itemBoxInput = document.getElementById('item-box'); 
const addItemButton = document.getElementById('add-item-button');
const itemsTableBody = document.getElementById('items-table-body');

const searchInput = document.getElementById('search-input');
const filterCategory = document.getElementById('filter-category');
const filterShelf = document.getElementById('filter-shelf');

const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');

// ===============================
// SISTEMA DE FEEDBACK (TOAST)
// ===============================
function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// ===============================
// ACESSIBILIDADE ATUALIZADA
// ===============================
const increaseFontButton = document.getElementById('increase-font');
const decreaseFontButton = document.getElementById('decrease-font');
const contrastButton = document.getElementById('contrast-button');

let tamanhoFonte = 16;

function carregarPreferencias() {
    const fonteSalva = localStorage.getItem("tamanhoFonte");
    const contrasteSalvo = localStorage.getItem("contrasteAtivo");
    
    if (fonteSalva) {
        tamanhoFonte = parseInt(fonteSalva, 10);
        body.style.fontSize = tamanhoFonte + "px";
    }
    
    if (contrasteSalvo === "true") {
        body.classList.add("high-contrast");
    }
}

function salvarPreferencias() {
    localStorage.setItem("tamanhoFonte", tamanhoFonte);
    localStorage.setItem("contrasteAtivo", body.classList.contains("high-contrast"));
}

increaseFontButton?.addEventListener('click', () => {
    if (tamanhoFonte < 24) { // Limite máximo para não quebrar o layout
        tamanhoFonte += 2;
        body.style.fontSize = tamanhoFonte + 'px';
        salvarPreferencias();
    }
});

decreaseFontButton?.addEventListener('click', () => {
    if (tamanhoFonte > 12) {
        tamanhoFonte -= 2;
        body.style.fontSize = tamanhoFonte + 'px';
        salvarPreferencias();
    }
});

contrastButton?.addEventListener('click', () => {
    body.classList.toggle('high-contrast');
    const estaAtivo = body.classList.contains('high-contrast');
    showToast(estaAtivo ? "Modo de Alto Contraste Ativado" : "Modo Padrão Ativado");
    salvarPreferencias();
});

carregarPreferencias();

// ===============================
// LOGIN / LOGOUT
// ===============================
loginButton?.addEventListener('click', async () => {
    if (loginErrorMessage) loginErrorMessage.textContent = '';
    try {
        await auth.signInAnonymously();
        showToast("Bem-vindo ao sistema!");
    } catch (error) {
        if (loginErrorMessage) loginErrorMessage.textContent = "Erro ao acessar o sistema.";
    }
});

logoutButton?.addEventListener('click', async () => {
    try {
        await auth.signOut();
        showToast("Sessão encerrada.");
    } catch (error) {
        showToast("Erro ao sair.");
    }
});

auth.onAuthStateChanged(user => {
    if (user) {
        loginSection?.classList.add('hidden');
        inventorySection?.classList.remove('hidden');
        loadInventory();
    } else {
        loginSection?.classList.remove('hidden');
        inventorySection?.classList.add('hidden');
    }
});

// ===============================
// SALVAR ITEM
// ===============================
addItemButton?.addEventListener('click', () => {
    const data = {
        name: itemNameInput.value.trim(),
        category: itemCategoryInput.value,
        unit: itemUnitInput.value,
        current: parseInt(itemCurrentInput.value, 10) || 0,
        minimum: parseInt(itemMinimumInput.value, 10) || 0,
        shelf: itemShelfInput.value,
        box: itemBoxInput.value,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    };

    if (!data.name) {
        showToast("⚠️ O nome do item é obrigatório.");
        itemNameInput.focus();
        return;
    }

    if (editKey) {
        database.ref('inventario/' + editKey).update(data)
            .then(() => {
                showToast("✅ Item atualizado!");
                finalizarEdicao();
            })
            .catch(() => showToast("❌ Erro ao atualizar."));
    } else {
        database.ref('inventario').push(data)
            .then(() => {
                showToast("📦 Item adicionado!");
                limparCampos();
            })
            .catch(() => showToast("❌ Erro ao adicionar."));
    }
});

// ===============================
// CARREGAR E RENDERIZAR
// ===============================
function loadInventory() {
    database.ref('inventario').on('value', snapshot => {
        inventoryData = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                inventoryData.push({ key: child.key, ...child.val() });
            });
        }
        renderTable();
    });
}

window.mudarPagina = (direcao) => {
    currentPage += direcao;
    renderTable();
    const tableContainer = document.querySelector('.inventory-table-container');
    if (tableContainer) {
        window.scrollTo({ top: tableContainer.offsetTop - 20, behavior: 'smooth' });
    }
};

function renderTable() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    const catFilter = filterCategory ? filterCategory.value : "";
    const shelfFilter = filterShelf ? filterShelf.value : "";

    let filtered = inventoryData.filter(item => {
        const matchesSearch = (item.name || "").toLowerCase().includes(searchTerm);
        const matchesCat = catFilter === "" || item.category === catFilter;
        const matchesShelf = shelfFilter === "" || item.shelf === shelfFilter;
        return matchesSearch && matchesCat && matchesShelf;
    });

    // Ordenação
    filtered.sort((a, b) => {
        let valA = a[currentSort.field] ?? '';
        let valB = b[currentSort.field] ?? '';
        if (typeof valA === 'string') {
            return currentSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            return currentSort.asc ? valA - valB : valB - valA;
        }
    });

    // Paginação
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedItems = filtered.slice(start, end);

    if (pageInfo) pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;

    if (!itemsTableBody) return;
    itemsTableBody.innerHTML = '';
    
    if (filtered.length === 0) {
        itemsTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 30px;">Nenhum item encontrado.</td></tr>';
        return;
    }

    paginatedItems.forEach(item => {
        let badgeClass = 'badge-verde'; 
        if (item.current <= item.minimum) {
            badgeClass = 'badge-vermelho';
        } else if (item.current <= item.minimum * 1.3) {
            badgeClass = 'badge-amarelo';
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>${item.category || '---'}</td>
            <td>${item.unit}</td>
            <td class="text-center">
                <div class="qty-controls">
                    <button class="btn-qty" onclick="ajustarQuantidade('${item.key}', -1)" aria-label="Remover 1">-</button>
                    <span class="inventory-badge ${badgeClass}">${item.current}</span>
                    <button class="btn-qty" onclick="ajustarQuantidade('${item.key}', 1)" aria-label="Adicionar 1">+</button>
                </div>
            </td>
            <td class="text-center">${item.minimum}</td>
            <td>P: ${item.shelf} / C: ${item.box}</td>
            <td class="no-print">
                <button class="edit-item-button" onclick="prepararEdicao('${item.key}')">Editar</button>
                <button class="delete-item-button" onclick="confirmarExclusao('${item.key}')">Excluir</button>
            </td>
        `;
        itemsTableBody.appendChild(row);
    });
}

const resetPageAndRender = () => {
    currentPage = 1;
    renderTable();
};

searchInput?.addEventListener('input', resetPageAndRender);
filterCategory?.addEventListener('change', resetPageAndRender);
filterShelf?.addEventListener('change', resetPageAndRender);

window.sortItems = (field) => {
    if (currentSort.field === field) {
        currentSort.asc = !currentSort.asc;
    } else {
        currentSort.field = field;
        currentSort.asc = true;
    }
    renderTable();
};

window.ajustarQuantidade = (key, mudanca) => {
    const item = inventoryData.find(i => i.key === key);
    if (!item) return;
    const novaQtd = Math.max(0, item.current + mudanca);
    database.ref('inventario/' + key).update({
        current: novaQtd,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        if (novaQtd <= item.minimum && mudanca < 0) {
            showToast(`⚠️ Estoque baixo: ${item.name}`);
        }
    });
};

window.prepararEdicao = (key) => {
    const item = inventoryData.find(i => i.key === key);
    if (!item) return;
    
    itemNameInput.value = item.name;
    itemCategoryInput.value = item.category || '';
    itemUnitInput.value = item.unit;
    itemCurrentInput.value = item.current;
    itemMinimumInput.value = item.minimum;
    itemShelfInput.value = item.shelf;
    itemBoxInput.value = item.box;
    
    editKey = key;
    addItemButton.textContent = "Salvar Alterações";
    addItemButton.classList.add("btn-save-edit");
    
    const cancelBtn = document.getElementById('cancel-edit-button');
    if (cancelBtn) cancelBtn.classList.remove('hidden');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    itemNameInput.focus();
};

window.confirmarExclusao = (key) => {
    if (confirm("Tem certeza que deseja excluir permanentemente este item?")) {
        database.ref('inventario/' + key).remove()
            .then(() => showToast("🗑️ Item removido com sucesso."))
            .catch(() => showToast("❌ Erro ao excluir o item."));
    }
};

window.finalizarEdicao = function() {
    editKey = null;
    if (addItemButton) {
        addItemButton.textContent = "Adicionar Item";
        addItemButton.classList.remove("btn-save-edit");
    }
    const cancelBtn = document.getElementById('cancel-edit-button');
    if (cancelBtn) cancelBtn.classList.add('hidden');
    limparCampos();
};

function limparCampos() {
    [itemNameInput, itemCategoryInput].forEach(el => el ? el.value = '' : null);
    if (itemUnitInput) itemUnitInput.value = 'un';
    [itemCurrentInput, itemMinimumInput].forEach(el => el ? el.value = 0 : null);
    if (itemShelfInput) itemShelfInput.value = 'A';
    if (itemBoxInput) itemBoxInput.value = '1';
}

// ===============================
// EXPORTAÇÃO E IMPRESSÃO
// ===============================
window.exportarExcel = function() {
    if (inventoryData.length === 0) {
        showToast("❌ Não há dados para exportar.");
        return;
    }
    if (typeof XLSX === 'undefined') {
        showToast("❌ Erro: Biblioteca Excel não carregada.");
        return;
    }

    try {
        const dadosPlanilha = inventoryData.map(item => ({
            "Item": item.name,
            "Categoria": item.category || "---",
            "Unidade": item.unit,
            "Qtd Atual": item.current,
            "Qtd Mínima": item.minimum,
            "Localização": `Prateleira ${item.shelf} - Caixa ${item.box}`,
            "Status": item.current <= item.minimum ? "REPOR" : "OK"
        }));

        const ws = XLSX.utils.json_to_sheet(dadosPlanilha);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Estoque");
        const dataRef = new Date().toLocaleDateString().replace(/\//g, '-');
        XLSX.writeFile(wb, `Estoque_Hidra_${dataRef}.xlsx`);
        showToast("📊 Excel gerado com sucesso!");
    } catch (e) {
        showToast("❌ Erro ao gerar planilha.");
    }
};

window.gerarPDF = function() {
    if (inventoryData.length === 0) {
        showToast("❌ Não há dados para imprimir.");
        return;
    }
    window.print();
};

// ===============================
// INTEGRAÇÃO API (JSON)
// ===============================
window.gerarLinkIntegracao = function() {
    // Tenta obter os dados da variável global inventoryData
    let dadosParaExportar = [];
    
    if (typeof inventoryData !== 'undefined' && inventoryData.length > 0) {
        // Mapeia os dados para um formato limpo, removendo metadados do Firebase se necessário
        dadosParaExportar = inventoryData.map(item => ({
            item: item.name,
            categoria: item.category || "---",
            unidade: item.unit,
            estoque_atual: item.current,
            estoque_minimo: item.minimum,
            local: `Prateleira ${item.shelf} - Caixa ${item.box}`,
            ultima_atualizacao: item.updatedAt ? new Date(item.updatedAt).toLocaleString('pt-BR') : "---"
        }));
    } else {
        // Fallback: Lê os dados diretamente da tabela HTML caso a variável esteja vazia
        const rows = document.querySelectorAll("#items-table-body tr");
        rows.forEach(row => {
            const cols = row.querySelectorAll("td");
            if (cols.length > 1) {
                dadosParaExportar.push({
                    item: cols[0].innerText,
                    categoria: cols[1].innerText,
                    unidade: cols[2].innerText,
                    estoque_atual: cols[3].innerText,
                    estoque_minimo: cols[4].innerText,
                    local: cols[5].innerText
                });
            }
        });
    }

    if (dadosParaExportar.length === 0) {
        showToast("⚠️ Não há dados disponíveis para exportar.");
        return;
    }

    try {
        // Cria o arquivo JSON
        const dataStr = JSON.stringify(dadosParaExportar, null, 4);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        // Cria um link temporário para download
        const link = document.createElement("a");
        link.href = url;
        const dataRef = new Date().toLocaleDateString().replace(/\//g, '-');
        link.download = `estoque_integracao_${dataRef}.json`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Libera a memória do objeto URL
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
        showToast("🔗 Arquivo JSON de integração gerado!");
    } catch (e) {
        showToast("❌ Erro ao gerar integração JSON.");
        console.error(e);
    }
};