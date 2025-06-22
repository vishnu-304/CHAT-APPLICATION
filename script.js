// News Service Class
class NewsService {
    constructor() {
        this.API_URL = 'https://content.guardianapis.com/search';
        this.API_KEY = 'test'; // Using test key - users should get their own
        this.DEFAULT_PARAMS = {
            'api-key': this.API_KEY,
            'show-fields': 'headline,trailText,thumbnail,bodyText',
            'page-size': '12',
            'order-by': 'newest'
        };
    }

    async fetchNews(params = {}) {
        try {
            const searchParams = new URLSearchParams({
                ...this.DEFAULT_PARAMS,
                page: (params.page || 1).toString(),
                ...(params.query && { q: params.query }),
                ...(params.section && params.section !== 'all' && { section: params.section })
            });

            const response = await fetch(`${this.API_URL}?${searchParams}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            return {
                articles: data.response.results || [],
                totalPages: data.response.pages || 1,
                currentPage: data.response.currentPage || 1
            };
        } catch (error) {
            console.error('Error fetching news:', error);
            throw new Error('Failed to fetch news articles. Please try again later.');
        }
    }

    getCategories() {
        return [
            'all',
            'world',
            'politics',
            'business',
            'technology',
            'environment',
            'science',
            'sport',
            'culture',
            'lifestyle'
        ];
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    extractImageUrl(article) {
        return article.fields?.thumbnail || 
               'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&h=250&fit=crop&crop=entropy&auto=format&q=80';
    }

    truncateText(text, maxLength = 150) {
        if (!text) return '';
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
    }
}

// News App Class
class NewsApp {
    constructor() {
        this.newsService = new NewsService();
        this.state = {
            articles: [],
            loading: true,
            error: null,
            currentPage: 1,
            totalPages: 1,
            searchQuery: '',
            selectedCategory: 'all'
        };
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderCategories();
        this.fetchNews();
    }

    bindEvents() {
        // Search input
        const searchInput = document.getElementById('searchInput');
        const clearSearch = document.getElementById('clearSearch');
        
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            this.state.searchQuery = query;
            
            // Show/hide clear button
            clearSearch.style.display = query ? 'block' : 'none';
            
            // Debounce search
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.state.currentPage = 1;
                this.fetchNews();
            }, 500);
        });

        clearSearch.addEventListener('click', () => {
            searchInput.value = '';
            this.state.searchQuery = '';
            clearSearch.style.display = 'none';
            this.state.currentPage = 1;
            this.fetchNews();
        });

        // Retry button
        const retryBtn = document.getElementById('retryBtn');
        retryBtn.addEventListener('click', () => {
            this.fetchNews();
        });
    }

    renderCategories() {
        const categoryFilter = document.getElementById('categoryFilter');
        const categories = this.newsService.getCategories();
        
        categoryFilter.innerHTML = categories.map(category => `
            <button class="category-btn ${category === this.state.selectedCategory ? 'active' : ''}" 
                    data-category="${category}">
                ${category === 'all' ? 'All News' : category}
            </button>
        `).join('');

        // Bind category events
        categoryFilter.addEventListener('click', (e) => {
            if (e.target.classList.contains('category-btn')) {
                const category = e.target.dataset.category;
                this.state.selectedCategory = category;
                this.state.currentPage = 1;
                
                // Update active state
                categoryFilter.querySelectorAll('.category-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                e.target.classList.add('active');
                
                this.fetchNews();
            }
        });
    }

    async fetchNews() {
        this.setState({ loading: true, error: null });
        this.showLoading();

        try {
            const { articles, totalPages, currentPage } = await this.newsService.fetchNews({
                query: this.state.searchQuery || undefined,
                section: this.state.selectedCategory !== 'all' ? this.state.selectedCategory : undefined,
                page: this.state.currentPage
            });

            this.setState({
                articles,
                totalPages,
                currentPage,
                loading: false
            });

            this.renderNews();
            this.renderPagination();
            this.renderResultsSummary();
        } catch (error) {
            this.setState({
                error: error.message,
                loading: false
            });
            this.showError();
        }
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
    }

    showLoading() {
        document.getElementById('loadingContainer').style.display = 'flex';
        document.getElementById('errorContainer').style.display = 'none';
        document.getElementById('newsGrid').style.display = 'none';
        document.getElementById('noResults').style.display = 'none';
        document.getElementById('pagination').style.display = 'none';
        document.getElementById('resultsSummary').style.display = 'none';
    }

    showError() {
        document.getElementById('loadingContainer').style.display = 'none';
        document.getElementById('errorContainer').style.display = 'flex';
        document.getElementById('newsGrid').style.display = 'none';
        document.getElementById('noResults').style.display = 'none';
        document.getElementById('pagination').style.display = 'none';
        document.getElementById('resultsSummary').style.display = 'none';
        
        document.getElementById('errorMessage').textContent = this.state.error;
    }

    renderNews() {
        const newsGrid = document.getElementById('newsGrid');
        const noResults = document.getElementById('noResults');
        
        document.getElementById('loadingContainer').style.display = 'none';
        document.getElementById('errorContainer').style.display = 'none';

        if (this.state.articles.length === 0) {
            newsGrid.style.display = 'none';
            noResults.style.display = 'block';
            return;
        }

        noResults.style.display = 'none';
        newsGrid.style.display = 'grid';
        
        newsGrid.innerHTML = this.state.articles.map(article => this.createNewsCard(article)).join('');
    }

    createNewsCard(article) {
        const imageUrl = this.newsService.extractImageUrl(article);
        const formattedDate = this.newsService.formatDate(article.webPublicationDate);
        const excerpt = this.newsService.truncateText(
            article.fields?.trailText || article.fields?.bodyText || '',
            120
        );

        return `
            <article class="news-card">
                <div class="news-card-image">
                    <img src="${imageUrl}" alt="${article.webTitle}" 
                         onerror="this.src='https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&h=250&fit=crop&crop=entropy&auto=format&q=80'">
                    <div class="news-card-category">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                            <line x1="7" y1="7" x2="7.01" y2="7"/>
                        </svg>
                        ${article.sectionName}
                    </div>
                </div>
                <div class="news-card-content">
                    <h2 class="news-card-title">${article.webTitle}</h2>
                    ${excerpt ? `<p class="news-card-excerpt">${excerpt}</p>` : ''}
                    <div class="news-card-meta">
                        <div class="news-card-date">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            <span>${formattedDate}</span>
                        </div>
                        ${article.pillarName ? `<span class="news-card-pillar">${article.pillarName}</span>` : ''}
                    </div>
                    <a href="${article.webUrl}" target="_blank" rel="noopener noreferrer" class="news-card-link">
                        Read Article
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15,3 21,3 21,9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                    </a>
                </div>
            </article>
        `;
    }

    renderPagination() {
        const pagination = document.getElementById('pagination');
        
        if (this.state.totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }

        pagination.style.display = 'flex';
        
        const visiblePages = this.getVisiblePages();
        
        pagination.innerHTML = `
            <button class="pagination-btn" ${this.state.currentPage === 1 ? 'disabled' : ''} 
                    onclick="newsApp.goToPage(${this.state.currentPage - 1})">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15,18 9,12 15,6"/>
                </svg>
            </button>
            
            ${visiblePages.map(page => {
                if (page === '...') {
                    return '<span class="pagination-dots">...</span>';
                }
                return `
                    <button class="pagination-number ${page === this.state.currentPage ? 'active' : ''}" 
                            onclick="newsApp.goToPage(${page})">
                        ${page}
                    </button>
                `;
            }).join('')}
            
            <button class="pagination-btn" ${this.state.currentPage === this.state.totalPages ? 'disabled' : ''} 
                    onclick="newsApp.goToPage(${this.state.currentPage + 1})">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9,18 15,12 9,6"/>
                </svg>
            </button>
        `;
    }

    getVisiblePages() {
        const delta = 2;
        const range = [];
        const rangeWithDots = [];
        const { currentPage, totalPages } = this.state;

        for (
            let i = Math.max(2, currentPage - delta);
            i <= Math.min(totalPages - 1, currentPage + delta);
            i++
        ) {
            range.push(i);
        }

        if (currentPage - delta > 2) {
            rangeWithDots.push(1, '...');
        } else {
            rangeWithDots.push(1);
        }

        rangeWithDots.push(...range);

        if (currentPage + delta < totalPages - 1) {
            rangeWithDots.push('...', totalPages);
        } else if (totalPages > 1) {
            rangeWithDots.push(totalPages);
        }

        return rangeWithDots;
    }

    renderResultsSummary() {
        const resultsSummary = document.getElementById('resultsSummary');
        const summaryText = document.getElementById('summaryText');
        
        if (this.state.loading || this.state.error) {
            resultsSummary.style.display = 'none';
            return;
        }

        resultsSummary.style.display = 'block';
        
        let text = '';
        if (this.state.searchQuery) {
            text = `Showing results for "<strong>${this.state.searchQuery}</strong>"`;
            if (this.state.selectedCategory !== 'all') {
                text += ` in <strong>${this.state.selectedCategory.charAt(0).toUpperCase() + this.state.selectedCategory.slice(1)}</strong>`;
            }
        } else {
            if (this.state.selectedCategory === 'all') {
                text = 'Latest News';
            } else {
                text = `Latest <strong>${this.state.selectedCategory.charAt(0).toUpperCase() + this.state.selectedCategory.slice(1)}</strong> News`;
            }
        }
        
        summaryText.innerHTML = text;
    }

    goToPage(page) {
        if (page < 1 || page > this.state.totalPages || page === this.state.currentPage) {
            return;
        }
        
        this.state.currentPage = page;
        this.fetchNews();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.newsApp = new NewsApp();
});