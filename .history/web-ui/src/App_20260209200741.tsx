// apps/web-ui/src/api/client.ts
import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:3000/api',
});

// ✅ ADD REQUEST INTERCEPTOR (Attach Token Automatically)
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('marine_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ NEUTRALIZE RESPONSE INTERCEPTOR
// We removed the logic that says "window.location.href = '/login'"
// Now, if an error happens, it will just pass the error to the Dashboard so we can see it.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

export default client;