import axios from 'axios'

/**
 * Instance Axios préconfigurée pour l'API CESIZen.
 * Base URL : répertoire backend servi par Laragon.
 * withCredentials : nécessaire pour transmettre les cookies de session PHP.
 */
const api = axios.create({
  baseURL: 'http://localhost/emotionalTracker/backend',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

export default api
