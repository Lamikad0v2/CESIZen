import axios from 'axios'

// VITE_API_BASE_URL :
//   - Local (Laragon)  : http://localhost/emotionalTracker/backend
//   - Docker           : '' (URLs relatives /api/..., même origine)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost/emotionalTracker/backend',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

export default api
