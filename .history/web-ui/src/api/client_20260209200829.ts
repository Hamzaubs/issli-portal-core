import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:3000',
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
    // If unauthorized, we clear session but don't force redirect 
    // unless necessary to avoid infinite loops during boot
    if (error.response?.status === 401) {
        console.warn("Unauthorized access detected.");
    }
    return Promise.reject(error);
  }
);

export default client;