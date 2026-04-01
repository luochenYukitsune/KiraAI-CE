/**
 * Unified API call function with JWT authentication
 */
async function apiCall(url, options = {}) {
    const jwtToken = localStorage.getItem('jwt_token');

    if (!jwtToken) {
        window.location.href = '/login';
        throw new Error('No JWT token found');
    }

    const headers = {
        ...options.headers
    };

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    headers['Authorization'] = `Bearer ${jwtToken}`;

    const timeout = options.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 401) {
            localStorage.removeItem('jwt_token');
            window.location.href = '/login';
            throw new Error('Unauthorized');
        }

        if (!response.ok && response.status >= 500) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Server error: ${response.status}`);
        }

        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            throw new Error('Request timeout');
        }
        
        throw error;
    }
}
