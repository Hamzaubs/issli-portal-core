// web-ui/src/api/client.ts
import axios from 'axios';

// 🌐 CLOUD-READY API CONNECTION
// If VITE_API_URL is set (in production), it uses that. Otherwise, defaults to local dev.
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

// Interceptor to attach token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('marine_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    // If unauthorized, log warning. Handled gracefully by React router guards.
    if (error.response?.status === 401) {
        console.warn("Unauthorized access detected.");
    }
    return Promise.reject(error);
  }
);

export default client;