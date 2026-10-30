// Configuration de l'API
const API_BASE = window.location.origin.includes('localhost') 
    ? 'http://localhost:3000/api' 
    : '/api';

// État de l'application
let state = {
    maisons: [],
    currentPage: 1,
    pageSize: 12,
    totalPages: 1,
    currentFilter: '',
    currentSearch: '',
    quartiers: [],
    map: null,
    markers: []
};

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSearch();
    initFilters();
    initForms();
    initModals();
    initMap();
    loadQuartiers();
    loadMaisons();
});

// Navigation entre les sections
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            sections.forEach(s => s.classList.remove('active'));
            const targetSection = document.getElementById(link.dataset.section);
            if (targetSection) {
                targetSection.classList.add('active');
            }
            
            if (link.dataset.section === 'accueil') {
                loadMaisons();
            }
            
            if (link.dataset.section === 'carte' && state.map) {
                setTimeout(() => {
                    state.map.invalidateSize();
                    if (state.markers.length > 0) {
                        const group = new L.featureGroup(state.markers);
                        state.map.fitBounds(group.getBounds().pad(0.5));
                    } else {
                        state.map.setView([48.5839, 7.7521], 13);
                    }
                }, 100);
            }
        });
    });
}

// Recherche
function initSearch() {
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');

    searchBtn.addEventListener('click', () => {
        state.currentSearch = searchInput.value.trim();
        state.currentPage = 1;
        loadMaisons();
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            state.currentSearch = searchInput.value.trim();
            state.currentPage = 1;
            loadMaisons();
        }
    });
}

// Filtres par quartier
function initFilters() {
    const quartierFilter = document.getElementById('quartier-filter');
    
    quartierFilter.addEventListener('change', (e) => {
        state.currentFilter = e.target.value;
        state.currentPage = 1;
        loadMaisons();
    });
}

// Chargement des quartiers
async function loadQuartiers() {
    try {
        const response = await fetch(`${API_BASE}/quartiers`);
        const data = await response.json();
        state.quartiers = data;
        
        const quartierFilter = document.getElementById('quartier-filter');
        const quartierSelect = document.getElementById('quartier');
        
        data.forEach(q => {
            const option = document.createElement('option');
            option.value = q.quartier;
            option.textContent = `${q.quartier} (${q.count})`;
            quartierFilter.appendChild(option);
        });
        
        const existingOptions = new Set([...quartierSelect.options].map(o => o.value));
        data.forEach(q => {
            if (!existingOptions.has(q.quartier)) {
                const option = document.createElement('option');
                option.value = q.quartier;
                option.textContent = q.quartier;
                quartierSelect.appendChild(option);
            }
        });
        
    } catch (error) {
        console.error('Erreur lors du chargement des quartiers:', error);
    }
}

// Chargement des maisons
async function loadMaisons() {
    const listContainer = document.getElementById('maisons-list');
    listContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Chargement...</p></div>';
    
    try {
        let url = `${API_BASE}/maisons?limit=${state.pageSize}&offset=${(state.currentPage - 1) * state.pageSize}`;
        
        if (state.currentFilter) {
            url += `&quartier=${encodeURIComponent(state.currentFilter)}`;
        }
        
        if (state.currentSearch) {
            url = `${API_BASE}/recherche?q=${encodeURIComponent(state.currentSearch)}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        state.maisons = data;
        
        if (data.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-home"></i>
                    <h3>Aucune maison trouvée</h3>
                    <p>${state.currentSearch ? 'Aucun résultat pour votre recherche' : 'Ajoutez une maison pour commencer'}</p>
                </div>
            `;
        } else {
            renderMaisons(data);
        }
        
        updatePagination();
        updateMap();
        
    } catch (error) {
        console.error('Erreur lors du chargement des maisons:', error);
        listContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Erreur de chargement</h3>
                <p>Impossible de charger les maisons. Veuillez réessayer.</p>
            </div>
        `;
    }
}

// Rendu des maisons
function renderMaisons(maisons) {
    const listContainer = document.getElementById('maisons-list');
    listContainer.innerHTML = '';
    
    maisons.forEach(maison => {
        const card = document.createElement('div');
        card.className = 'maison-card';
        card.dataset.id = maison.id;
        
        card.innerHTML = `
            <div class="maison-image">
                ${maison.image_url ? `<img src="${escapeHtml(maison.image_url)}" alt="${escapeHtml(maison.adresse)}">` : '<i class="fas fa-image placeholder"></i>'}
            </div>
            <div class="maison-info">
                <h3>${escapeHtml(maison.adresse)}</h3>
                <span class="quartier">${escapeHtml(maison.quartier)}</span>
                <p>${escapeHtml(maison.description || 'Aucune description disponible')}</p>
                <div class="rating" data-maison-id="${maison.id}">
                    <div class="stars" id="stars-${maison.id}">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                    <span class="count" id="count-${maison.id}">Chargement...</span>
                </div>
            </div>
        `;
        
        card.addEventListener('click', () => showMaisonDetail(maison));
        listContainer.appendChild(card);
        
        loadRating(maison.id);
    });
}

// Chargement de la note moyenne
async function loadRating(maisonId) {
    try {
        const response = await fetch(`${API_BASE}/maisons/${maisonId}/note-moyenne`);
        const data = await response.json();
        
        const starsContainer = document.getElementById(`stars-${maisonId}`);
        const countElement = document.getElementById(`count-${maisonId}`);
        
        if (starsContainer && countElement) {
            starsContainer.innerHTML = renderStars(data.moyenne);
            countElement.textContent = `${data.count} avis`;
        }
        
    } catch (error) {
        console.error('Erreur lors du chargement de la note:', error);
    }
}

// Rendu des étoiles
function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '';
    
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star"></i>';
    }
    
    if (hasHalfStar) {
        stars += '<i class="fas fa-star-half-alt"></i>';
    }
    
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="far fa-star"></i>';
    }
    
    return stars;
}

// Pagination
function updatePagination() {
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = '';
}

// Formulaires
function initForms() {
    const addMaisonForm = document.getElementById('add-maison-form');
    
    addMaisonForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            adresse: document.getElementById('adresse').value.trim(),
            quartier: document.getElementById('quartier').value,
            description: document.getElementById('description').value.trim(),
            image_url: document.getElementById('image_url').value.trim() || null,
            latitude: document.getElementById('latitude').value ? parseFloat(document.getElementById('latitude').value) : null,
            longitude: document.getElementById('longitude').value ? parseFloat(document.getElementById('longitude').value) : null
        };
        
        if (!formData.adresse || !formData.quartier) {
            showToast('Veuillez remplir les champs obligatoires', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/maisons`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                throw new Error('Erreur lors de l\'ajout');
            }
            
            const data = await response.json();
            showToast('Maison ajoutée avec succès!', 'success');
            
            addMaisonForm.reset();
            
            state.currentPage = 1;
            loadMaisons();
            
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            document.querySelector('.nav-link[data-section="accueil"]').classList.add('active');
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById('accueil').classList.add('active');
            
        } catch (error) {
            console.error('Erreur:', error);
            showToast('Erreur lors de l\'ajout de la maison', 'error');
        }
    });
    
    const addNoteForm = document.getElementById('add-note-form');
    
    addNoteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const maisonId = document.getElementById('note-maison-id').value;
        const note = document.getElementById('note-value').value;
        const commentaire = document.getElementById('commentaire').value.trim();
        
        if (!note || note === '0') {
            showToast('Veuillez sélectionner une note', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/maisons/${maisonId}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    note: parseInt(note),
                    commentaire: commentaire
                })
            });
            
            if (!response.ok) {
                throw new Error('Erreur lors de l\'ajout de la note');
            }
            
            showToast('Note ajoutée avec succès!', 'success');
            
            closeModal('note-modal');
            
            addNoteForm.reset();
            document.getElementById('note-value').value = '0';
            document.querySelectorAll('.star-rating i').forEach(i => i.classList.remove('active'));
            
            loadMaisonNotes(maisonId);
            loadRating(maisonId);
            
        } catch (error) {
            console.error('Erreur:', error);
            showToast('Erreur lors de l\'ajout de la note', 'error');
        }
    });
    
    const starRating = document.getElementById('star-rating');
    
    starRating.addEventListener('click', (e) => {
        if (e.target.tagName === 'I') {
            const value = e.target.dataset.value;
            document.getElementById('note-value').value = value;
            
            starRating.querySelectorAll('i').forEach((star, index) => {
                if (index < value) {
                    star.classList.add('active');
                } else {
                    star.classList.remove('active');
                }
            });
        }
    });
}

// Modals
function initModals() {
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(btn.closest('.modal').id);
        });
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                closeModal(modal.id);
            });
        }
    });
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Détails de la maison
async function showMaisonDetail(maison) {
    const modalBody = document.getElementById('modal-body');
    const maisonId = maison.id;
    
    try {
        const notesResponse = await fetch(`${API_BASE}/maisons/${maisonId}/notes`);
        const notes = await notesResponse.json();
        
        const ratingResponse = await fetch(`${API_BASE}/maisons/${maisonId}/note-moyenne`);
        const rating = await ratingResponse.json();
        
        modalBody.innerHTML = `
            <div class="maison-detail">
                <h2>${escapeHtml(maison.adresse)}</h2>
                
                <div class="maison-image-large">
                    ${maison.image_url ? `<img src="${escapeHtml(maison.image_url)}" alt="${escapeHtml(maison.adresse)}">` : '<i class="fas fa-image placeholder"></i>'}
                </div>
                
                <div class="maison-info-detail">
                    <div class="info-row">
                        <div>
                            <span class="info-label">Quartier:</span>
                            <span class="info-value quartier">${escapeHtml(maison.quartier)}</span>
                        </div>
                        <div>
                            <span class="info-label">Note moyenne:</span>
                            <span class="info-value">
                                <div class="rating">
                                    <div class="stars">${renderStars(rating.moyenne)}</div>
                                    <span class="count">${rating.count} avis</span>
                                </div>
                            </span>
                        </div>
                    </div>
                    
                    ${maison.description ? `
                        <div>
                            <span class="info-label">Description:</span>
                            <p class="description">${escapeHtml(maison.description)}</p>
                        </div>
                    ` : ''}
                    
                    ${maison.latitude && maison.longitude ? `
                        <div class="info-row">
                            <span class="info-label">Coordonnées:</span>
                            <span class="info-value">${maison.latitude.toFixed(6)}, ${maison.longitude.toFixed(6)}</span>
                        </div>
                    ` : ''}
                    
                    <div class="info-row">
                        <span class="info-label">Ajoutée le:</span>
                        <span class="info-value">${new Date(maison.date_ajout).toLocaleDateString('fr-FR')}</span>
                    </div>
                </div>
                
                <button class="btn btn-primary add-note-btn" onclick="showNoteModal(${maisonId})">
                    <i class="fas fa-plus"></i> Ajouter une note
                </button>
                
                ${notes.length > 0 ? `
                    <div class="notes-section">
                        <h3>Derniers avis (${notes.length})</h3>
                        <div id="notes-list-${maisonId}">
                            ${notes.map(note => `
                                <div class="note-item">
                                    <div class="note-header">
                                        <div class="note-stars">${renderStars(note.note)}</div>
                                        <span class="note-date">${new Date(note.date_note).toLocaleDateString('fr-FR')}</span>
                                    </div>
                                    ${note.commentaire ? `<p class="note-comment">${escapeHtml(note.commentaire)}</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        showModal('maison-modal');
        
    } catch (error) {
        console.error('Erreur lors du chargement des détails:', error);
        showToast('Erreur lors du chargement des détails', 'error');
    }
}

// Charger les notes d'une maison
async function loadMaisonNotes(maisonId) {
    try {
        const response = await fetch(`${API_BASE}/maisons/${maisonId}/notes`);
        const notes = await response.json();
        
        const notesList = document.getElementById(`notes-list-${maisonId}`);
        if (notesList) {
            notesList.innerHTML = notes.map(note => `
                <div class="note-item">
                    <div class="note-header">
                        <div class="note-stars">${renderStars(note.note)}</div>
                        <span class="note-date">${new Date(note.date_note).toLocaleDateString('fr-FR')}</span>
                    </div>
                    ${note.commentaire ? `<p class="note-comment">${escapeHtml(note.commentaire)}</p>` : ''}
                </div>
            `).join('');
        }
        
    } catch (error) {
        console.error('Erreur lors du chargement des notes:', error);
    }
}

// Afficher la modal de note
function showNoteModal(maisonId) {
    document.getElementById('note-maison-id').value = maisonId;
    document.getElementById('commentaire').value = '';
    document.getElementById('note-value').value = '0';
    document.querySelectorAll('.star-rating i').forEach(i => i.classList.remove('active'));
    showModal('note-modal');
}

// Carte Leaflet
function initMap() {
    state.map = L.map('map').setView([48.5839, 7.7521], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(state.map);
    
    document.getElementById('center-map').addEventListener('click', () => {
        state.map.setView([48.5839, 7.7521], 13);
    });
    
    updateMap();
}

// Mettre à jour la carte avec les maisons
function updateMap() {
    if (!state.map) return;
    
    state.markers.forEach(marker => state.map.removeLayer(marker));
    state.markers = [];
    
    state.maisons.forEach(maison => {
        if (maison.latitude && maison.longitude) {
            const icon = L.divIcon({
                className: 'maison-marker',
                html: `<i class="fas fa-home" style="color: #d32f2f; font-size: 24px;"></i>`,
                iconSize: [30, 30]
            });
            
            const marker = L.marker([maison.latitude, maison.longitude], { icon: icon })
                .addTo(state.map)
                .bindPopup(`
                    <div class="popup-content">
                        <h3>${escapeHtml(maison.adresse)}</h3>
                        <span class="quartier">${escapeHtml(maison.quartier)}</span>
                        <p>${escapeHtml(maison.description || 'Aucune description')}</p>
                        <div class="rating">
                            <div class="stars" id="popup-stars-${maison.id}">Chargement...</div>
                            <span class="count" id="popup-count-${maison.id}">...</span>
                        </div>
                        <button class="btn btn-primary" onclick="showMaisonDetail(${JSON.stringify(maison).replace(/\"/g, '&quot;')});" style="margin-top: 10px; width: 100%;">
                            Voir les détails
                        </button>
                    </div>
                `);
            
            state.markers.push(marker);
            
            loadRatingForPopup(maison.id);
        }
    });
    
    if (state.markers.length > 0) {
        const group = new L.featureGroup(state.markers);
        state.map.fitBounds(group.getBounds().pad(0.5));
    }
}

// Charger la note pour le popup de la carte
async function loadRatingForPopup(maisonId) {
    try {
        const response = await fetch(`${API_BASE}/maisons/${maisonId}/note-moyenne`);
        const data = await response.json();
        
        const starsContainer = document.getElementById(`popup-stars-${maisonId}`);
        const countElement = document.getElementById(`popup-count-${maisonId}`);
        
        if (starsContainer) {
            starsContainer.innerHTML = renderStars(data.moyenne);
        }
        if (countElement) {
            countElement.textContent = `${data.count} avis`;
        }
        
    } catch (error) {
        console.error('Erreur:', error);
    }
}

// Toast notifications
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Fonctions utilitaires
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getPlaceholderImage(adresse) {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b'];
    const index = adresse.length % colors.length;
    return `https://via.placeholder.com/400x300/${colors[index].substring(1)}/ffffff?text=${encodeURIComponent(adresse.substring(0, 20))}`;
}

// Exposer les fonctions globales
window.showMaisonDetail = showMaisonDetail;
window.showNoteModal = showNoteModal;
