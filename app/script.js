// app/script.js
// Inicializa el mapa centrado en Buenos Aires
var map = L.map('map').setView([-38.163535008219654, -58.7829839169688], 13);

// Añade una capa de mapa base de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Cargar las ubicaciones desde el JSON
fetch('/datos/ubicaciones.json')
    .then(response => response.json())
    .then(data => {
        data.forEach(lugar => {
            // Verifica que productos sea un array
            let listaProductos = Array.isArray(lugar.productos)
                ? lugar.productos.map(p => `• ${p}`).join("<br>")
                : lugar.productos; // Si no es array, muestra el valor directamente

            // Definir un icono personalizado para cada ubicación
            var iconoPersonalizado = L.icon({
                iconUrl: lugar.imagen, // Usa la imagen definida en el JSON
                iconSize: [32, 37],
                iconAnchor: [16, 37],
                popupAnchor: [0, -28]
            });

            // Crear el marcador
            var marker = L.marker(lugar.coordenadas, { icon: iconoPersonalizado }).addTo(map);

            // Contenido del popup
            var popupContenido = `
                <b>${lugar.nombre}</b><br>
                ${lugar.descripcion}<br>
                Dirección: ${lugar.direccion}<br>
                <b>Productos/Servicios:</b><br>${listaProductos}
            `;

            // Asociar el popup al marcador
            marker.bindPopup(popupContenido);
        });
    })
    .catch(error => console.error('Error al cargar las ubicaciones:', error));
