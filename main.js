// main.js
// Inicializa la aplicación usando la arquitectura MVC

document.addEventListener('DOMContentLoaded', () => {
    try {
        const app = new window.AppController();
        window.app = app;
    } catch (error) {
        const sanitizedMessage = String(error.message || 'Error desconocido').replace(/[\r\n<>"'&]/g, ' ');
        console.error('Error inicializando aplicación:', sanitizedMessage);
        document.body.textContent = 'Error: No se pudo inicializar la aplicación';
    }
});