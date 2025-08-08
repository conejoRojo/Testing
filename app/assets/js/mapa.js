/**
 * assets/js/mapa.js - Mapa Interactivo para Nutrien Ag Solutions
 * Integrado con Bootstrap y estructura HTML existente
 */

'use strict';

/* ==========================================
   CONFIGURACIÓN Y CONSTANTES
   ========================================== */
const CONFIG_MAPA = {
    // Configuración del mapa
    mapa: {
        centroArgentina: [-38.416097, -63.616672],
        zoomInicial: 5,
        zoomDetalle: 15,
        maxZoom: 18
    },
    
    // Rutas de archivos
    rutas: {
        datos: './assets/datos/ubicaciones.json',
        imagenes: './assets/img/'
    },
    
    // Timeouts y delays
    tiempo: {
        timeoutFetch: 10000,
        delayPopup: 500,
        errorDisplay: 5000
    },
    
    // Colores por provincia (verde Nutrien como principal)
    coloresProvincia: {
        'Buenos Aires': '#86d500',
        'Córdoba': '#28a745',
        'Mendoza': '#dc3545',
        'Santa Fe': '#ffc107',
        'Río Negro': '#6f42c1',
        'Salta': '#fd7e14',
        'Tucumán': '#20c997',
        'Entre Ríos': '#e83e8c'
    },
    
    // Rangos de coordenadas válidas para Argentina
    coordenadas: {
        latMin: -55,
        latMax: -20,
        lngMin: -75,
        lngMax: -50
    }
};

/* ==========================================
   SELECTORES DOM ADAPTADOS
   ========================================== */
const SELECTORES_MAPA = {
    mapa: '#map',
    provinciaSelect: '#provinciaSelect',
    lugaresContenedor: '#lugares-contenedor',
    provinciaInfo: '#provincia-info',
    provinciaTitulo: '#provincia-titulo',
    agrocentrosLista: '#agrocentros-lista'
};

/* ==========================================
   UTILIDADES
   ========================================== */
const UtilsMapa = {
    /**
     * Escapa HTML para prevenir XSS
     */
    escaparHtml(texto) {
        if (typeof texto !== 'string') {
            return String(texto);
        }
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    },

    /**
     * Debounce para optimizar eventos
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Valida si un objeto es una ubicación válida
     */
    validarUbicacion(lugar) {
        if (!lugar || typeof lugar !== 'object') {
            return false;
        }

        // Validar solo campos absolutamente requeridos
        const camposRequeridos = ['nombre', 'provincia', 'coordenadas'];
        for (const campo of camposRequeridos) {
            if (!lugar[campo]) {
                console.warn(`Campo requerido faltante: ${campo}`, lugar);
                return false;
            }
            
            if (typeof lugar[campo] === 'string' && lugar[campo].trim() === '') {
                console.warn(`Campo requerido vacío: ${campo}`, lugar);
                return false;
            }
        }

        // Validar coordenadas específicamente
        if (!Array.isArray(lugar.coordenadas) || lugar.coordenadas.length !== 2) {
            console.warn('Coordenadas inválidas - debe ser array de 2 elementos', lugar);
            return false;
        }

        const [lat, lng] = lugar.coordenadas;
        if (typeof lat !== 'number' || typeof lng !== 'number') {
            console.warn('Coordenadas deben ser números', lugar);
            return false;
        }

        // Validar rangos de coordenadas para Argentina
        const { latMin, latMax, lngMin, lngMax } = CONFIG_MAPA.coordenadas;
        if (lat < latMin || lat > latMax || lng < lngMin || lng > lngMax) {
            console.warn(`Coordenadas fuera del rango de Argentina: ${lugar.nombre}`, lugar);
            return false;
        }

        return true;
    },

    /**
     * Limpia y normaliza datos de ubicación
     */
    normalizarUbicacion(lugar) {
        const ubicacionLimpia = { ...lugar };

        // Limpiar campos opcionales
        ubicacionLimpia.descripcion = ubicacionLimpia.descripcion || 'Sin descripción disponible';
        ubicacionLimpia.direccion = ubicacionLimpia.direccion || 'Dirección no especificada';
        
        if (!Array.isArray(ubicacionLimpia.productos)) {
            ubicacionLimpia.productos = [];
        }
        
        ubicacionLimpia.productos = ubicacionLimpia.productos.filter(p => 
            p && typeof p === 'string' && p.trim() !== ''
        );

        if (ubicacionLimpia.productos.length === 0) {
            ubicacionLimpia.productos = ['Servicios disponibles'];
        }

        ubicacionLimpia.telefono = ubicacionLimpia.telefono && ubicacionLimpia.telefono.trim() !== '' 
            ? ubicacionLimpia.telefono : null;
        ubicacionLimpia.email = ubicacionLimpia.email && ubicacionLimpia.email.trim() !== '' 
            ? ubicacionLimpia.email : null;

        return ubicacionLimpia;
    },

    /**
     * Obtiene color por provincia
     */
    obtenerColorProvincia(provincia) {
        return CONFIG_MAPA.coloresProvincia[provincia] || '#6c757d';
    }
};

/* ==========================================
   GESTOR DE ERRORES
   ========================================== */
const ErrorManagerMapa = {
    /**
     * Muestra error de forma no intrusiva
     */
    mostrar(mensaje, tipo = 'error') {
        console.error(mensaje);
        
        // Crear notificación temporal estilo Bootstrap
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-danger alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        `;
        
        alertDiv.innerHTML = `
            ${UtilsMapa.escaparHtml(mensaje)}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

        document.body.appendChild(alertDiv);

        // Auto-remover después del tiempo configurado
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, CONFIG_MAPA.tiempo.errorDisplay);
    }
};

/* ==========================================
   GESTOR DE DATOS
   ========================================== */
const DataManagerMapa = {
    /**
     * Carga datos desde el JSON
     */
    async cargarUbicaciones() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG_MAPA.tiempo.timeoutFetch);

            const response = await fetch(CONFIG_MAPA.rutas.datos, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!Array.isArray(data)) {
                throw new Error('Los datos no tienen el formato esperado (debe ser un array)');
            }

            // Normalizar y validar todas las ubicaciones
            const ubicacionesValidas = data
                .map(ubicacion => UtilsMapa.normalizarUbicacion(ubicacion))
                .filter(ubicacion => {
                    const esValida = UtilsMapa.validarUbicacion(ubicacion);
                    if (!esValida) {
                        console.warn('Ubicación inválida filtrada:', ubicacion);
                    }
                    return esValida;
                });

            if (ubicacionesValidas.length === 0) {
                throw new Error(`No se encontraron ubicaciones válidas en los datos. Se procesaron ${data.length} registros.`);
            }

            console.log(`Cargadas ${ubicacionesValidas.length} ubicaciones válidas de ${data.length} registros totales`);
            return ubicacionesValidas;

        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Timeout al cargar los datos. Verifique su conexión.');
            }
            throw error;
        }
    }
};

/* ==========================================
   GESTOR DE ICONOS
   ========================================== */
const IconManagerMapa = {
    /**
     * Crea icono personalizado para marcador
     */
    crear(lugar) {
        // Usar imagen si está disponible, sino usar nutrien-agros.svg
        if (lugar.imagen) {
            return this._crearIconoImagen(lugar);
        }
        
        const lugarConIcono = { ...lugar, imagen: `${CONFIG_MAPA.rutas.imagenes}nutrien-agros.svg` };
        return this._crearIconoImagen(lugarConIcono);
    },

    _crearIconoImagen(lugar) {
        const iconUrl = lugar.imagen || `${CONFIG_MAPA.rutas.imagenes}nutrien-agros.svg`;
        console.log('Intentando cargar icono:', iconUrl); // Debug
        
        return L.icon({
            iconUrl: iconUrl,
            iconSize: [32, 37],
            iconAnchor: [16, 37],
            popupAnchor: [0, -37],
            shadowUrl: null, // Desactivar sombra
            shadowSize: null,
            className: 'marcador-personalizado'
        });
    }
};

/* ==========================================
   GESTOR DE POPUP
   ========================================== */
const PopupManagerMapa = {
    /**
     * Crea contenido HTML para popup
     */
    crearContenido(lugar) {
        const datos = this._procesarDatos(lugar);
        return this._construirHTML(datos);
    },

    _procesarDatos(lugar) {
        return {
            nombre: UtilsMapa.escaparHtml(lugar.nombre),
            provincia: UtilsMapa.escaparHtml(lugar.provincia),
            descripcion: UtilsMapa.escaparHtml(lugar.descripcion),
            region: UtilsMapa.escaparHtml(lugar.region),
            direccion: UtilsMapa.escaparHtml(lugar.direccion),
            color: UtilsMapa.obtenerColorProvincia(lugar.provincia)
        };
    },

    _procesarProductos(productos) {
        if (Array.isArray(productos)) {
            return productos.map(p => `• ${UtilsMapa.escaparHtml(p)}`).join('<br>');
        }
        return productos ? UtilsMapa.escaparHtml(productos) : '';
    },

    _construirHTML(datos) {
        let html = `
            <div class="popup-contenido">
                <h3 style="margin: 0 0 10px 0; color: ${datos.color};">
                    ${datos.nombre}
                </h3>
                <p style="margin: 5px 0; font-style: italic;">
                    <strong>${datos.region}</strong>
                </p>
                
                <p style="margin: 5px 0;">${datos.descripcion}</p>
                <p style="margin: 5px 0;">
                    <strong>Dirección:</strong> ${datos.direccion}
                </p>
        `;
      

        html += '</div>';
        return html;
    }
};

/* ==========================================
   CLASE PRINCIPAL - MAPA NUTRIEN
   ========================================== */
class MapaNutrien {
    constructor() {
        this.map = null;
        this.marcadores = [];
        this.ubicaciones = [];
        this.grupoMarcadores = null;
        this.elementosDOM = {};
        this.provinciaActual = '';
        
        // Esperar a que se carguen todos los scripts
        this._esperarInicializacion();
    }

    _esperarInicializacion() {
        // Esperar a que se carguen Bootstrap y otros scripts
        if (typeof bootstrap === 'undefined' || typeof L === 'undefined') {
            setTimeout(() => this._esperarInicializacion(), 100);
            return;
        }
        
        this.init();
    }

    async init() {
        try {
            this._cachearElementosDOM();
            this._verificarPrerequisitos();
            this._initMapa();
            await this._cargarDatos();
            this._initEventos();
            
            console.log('Mapa Nutrien inicializado correctamente');
        } catch (error) {
            console.error('Error inicializando el mapa:', error);
            ErrorManagerMapa.mostrar('Error al inicializar el mapa interactivo');
        }
    }

    _cachearElementosDOM() {
        for (const [nombre, selector] of Object.entries(SELECTORES_MAPA)) {
            this.elementosDOM[nombre] = document.querySelector(selector);
        }
    }

    _verificarPrerequisitos() {
        if (typeof L === 'undefined') {
            throw new Error('Leaflet no está cargado');
        }

        if (!this.elementosDOM.mapa) {
            throw new Error('Contenedor del mapa no encontrado');
        }
    }

    _initMapa() {
        try {
            const container = this.elementosDOM.mapa;
            if (!container) {
                throw new Error('Contenedor del mapa no encontrado');
            }

            // Limpiar contenedor si tiene contenido previo
            if (container._leaflet_id) {
                container._leaflet_id = null;
            }
            container.innerHTML = '';

            this.map = L.map(container, {
                center: CONFIG_MAPA.mapa.centroArgentina,
                zoom: CONFIG_MAPA.mapa.zoomInicial,
                zoomControl: true,
                attributionControl: true
            });

            // Forzar invalidación del tamaño del mapa
            setTimeout(() => {
                if (this.map && this.map.getContainer()) {
                    this.map.invalidateSize();
                }
            }, 100);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                maxZoom: CONFIG_MAPA.mapa.maxZoom,
                subdomains: ['a', 'b', 'c'],
                crossOrigin: true
            }).addTo(this.map);

            this.grupoMarcadores = L.featureGroup().addTo(this.map);
        } catch (error) {
            console.error('Error inicializando mapa:', error);
            throw error;
        }
    }

    async _cargarDatos() {
        try {
            this.ubicaciones = await DataManagerMapa.cargarUbicaciones();
            this._poblarProvincias();
            this._crearMarcadores();
            
        } catch (error) {
            console.error('Error cargando datos:', error);
            ErrorManagerMapa.mostrar('Error al cargar los datos del mapa');
        }
    }

    _poblarProvincias() {
        if (!this.elementosDOM.provinciaSelect) {
            console.warn('Elemento select de provincias no encontrado');
            return;
        }

        // Ordenar ubicaciones alfabéticamente por provincia y luego por nombre
        this.ubicaciones.sort((a, b) => {
            const provinciaA = a.provincia.trim();
            const provinciaB = b.provincia.trim();
            
            if (provinciaA !== provinciaB) {
                return provinciaA.localeCompare(provinciaB);
            }
            
            return a.nombre.trim().localeCompare(b.nombre.trim());
        });

        const provincias = [...new Set(
            this.ubicaciones
                .map(item => item.provincia.trim())
                .filter(Boolean)
        )].sort();

        // Limpiar opciones existentes (excepto la primera)
        while (this.elementosDOM.provinciaSelect.children.length > 1) {
            this.elementosDOM.provinciaSelect.removeChild(
                this.elementosDOM.provinciaSelect.lastChild
            );
        }

        // Agregar opciones de provincias
        provincias.forEach(provincia => {
            const option = document.createElement('option');
            option.value = provincia;
            option.textContent = provincia;
            this.elementosDOM.provinciaSelect.appendChild(option);
        });
    }

    _crearMarcadores() {
        this._limpiarMarcadores();

        this.ubicaciones.forEach((lugar, index) => {
            try {
                const icono = IconManagerMapa.crear(lugar);
                const marker = L.marker(lugar.coordenadas, { 
                    icon: icono,
                    alt: lugar.nombre,
                    title: lugar.nombre
                });

                const popupContenido = PopupManagerMapa.crearContenido(lugar);
                
                marker.bindPopup(popupContenido, {
                    maxWidth: 350,
                    minWidth: 250,
                    className: 'popup-personalizado'
                });

                marker.on('click', () => {
                    this._seleccionarLugar(lugar);
                });

                marker.ubicacionData = lugar;
                this.grupoMarcadores.addLayer(marker);
                this.marcadores.push(marker);

            } catch (error) {
                console.error(`Error creando marcador para ${lugar.nombre}:`, error);
            }
        });
    }

    _actualizarListaLugares(provincia) {
        const contenedor = this.elementosDOM.lugaresContenedor;
        const infoContainer = this.elementosDOM.provinciaInfo;
        const titulo = this.elementosDOM.provinciaTitulo;

        if (!contenedor) return;

        if (!provincia) {
            // Mostrar estado inicial
            contenedor.innerHTML = '<li class="texto-inicial">Seleccione una provincia para ver las ubicaciones</li>';
            if (infoContainer) infoContainer.style.display = 'none';
            return;
        }

        // Filtrar ubicaciones por provincia y ordenar alfabéticamente
        const ubicacionesFiltradas = this.ubicaciones
            .filter(u => u.provincia.trim() === provincia.trim())
            .sort((a, b) => a.nombre.trim().localeCompare(b.nombre.trim()));

        if (ubicacionesFiltradas.length === 0) {
            contenedor.innerHTML = '<li class="texto-inicial">No hay ubicaciones disponibles</li>';
            if (infoContainer) infoContainer.style.display = 'none';
            return;
        }

        // Actualizar título con formato requerido
        if (titulo && infoContainer) {
            titulo.innerHTML = `${provincia.toUpperCase()} <strong>(${ubicacionesFiltradas.length})</strong>`;
            infoContainer.style.display = 'block';
        }

        // Generar lista de ubicaciones ordenadas
        contenedor.innerHTML = '';
        ubicacionesFiltradas.forEach((lugar) => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = lugar.nombre;
            
            a.addEventListener('click', (e) => {
                e.preventDefault();
                this._seleccionarLugar(lugar);
                
                // Remover clase active de todos los elementos
                contenedor.querySelectorAll('li').forEach(item => item.classList.remove('active'));
                // Agregar clase active al elemento seleccionado
                li.classList.add('active');
            });
            
            li.appendChild(a);
            contenedor.appendChild(li);
        });
    }

    _seleccionarLugar(lugar) {
        const marcador = this.marcadores.find(m => 
            m.ubicacionData.nombre === lugar.nombre &&
            m.ubicacionData.coordenadas[0] === lugar.coordenadas[0] &&
            m.ubicacionData.coordenadas[1] === lugar.coordenadas[1]
        );

        if (marcador) {
            this.map.setView(lugar.coordenadas, CONFIG_MAPA.mapa.zoomDetalle);
            marcador.openPopup();
            
            // Añadir animación de bounce al marcador
            const icon = marcador.getElement();
            if (icon) {
                icon.classList.add('marker-bounce');
                setTimeout(() => {
                    icon.classList.remove('marker-bounce');
                }, 1000);
            }
        }
    }

    _filtrarPorProvincia(provincia) {
        try {
            this.provinciaActual = provincia;
            
            if (!provincia || provincia === '') {
                this._mostrarTodosMarcadores();
                this._actualizarListaLugares('');
                return;
            }

            const ubicacionesFiltradas = this.ubicaciones.filter(u => 
                u.provincia && u.provincia.trim() === provincia.trim()
            );
            
            this._actualizarListaLugares(provincia);

            if (ubicacionesFiltradas.length === 0) {
                return;
            }

            // Verificar que el grupo de marcadores existe
            if (!this.grupoMarcadores) {
                this.grupoMarcadores = L.featureGroup().addTo(this.map);
            }

            // Mostrar solo marcadores de la provincia seleccionada
            this.grupoMarcadores.clearLayers();
            
            const marcadoresVisibles = this.marcadores.filter(marker => 
                marker.ubicacionData && marker.ubicacionData.provincia === provincia
            );

            marcadoresVisibles.forEach(marker => {
                this.grupoMarcadores.addLayer(marker);
            });

            // Centrar mapa y seleccionar primer lugar
            if (marcadoresVisibles.length > 0) {
                try {
                    const grupo = L.featureGroup(marcadoresVisibles);
                    this.map.fitBounds(grupo.getBounds().pad(0.1));
                    
                    setTimeout(() => {
                        this._seleccionarLugar(ubicacionesFiltradas[0]);
                    }, CONFIG_MAPA.tiempo.delayPopup);
                } catch (boundsError) {
                    console.warn('Error ajustando bounds, usando setView:', boundsError);
                    this.map.setView(ubicacionesFiltradas[0].coordenadas, CONFIG_MAPA.mapa.zoomDetalle);
                }
            }

        } catch (error) {
            console.error('Error filtrando por provincia:', error);
            ErrorManagerMapa.mostrar('Error al filtrar ubicaciones');
        }
    }

    _mostrarTodosMarcadores() {
        try {
            if (!this.grupoMarcadores) {
                this.grupoMarcadores = L.featureGroup().addTo(this.map);
            }

            this.grupoMarcadores.clearLayers();
            this.marcadores.forEach(marker => {
                this.grupoMarcadores.addLayer(marker);
            });
            this.map.setView(CONFIG_MAPA.mapa.centroArgentina, CONFIG_MAPA.mapa.zoomInicial);
        } catch (error) {
            console.error('Error mostrando todos los marcadores:', error);
        }
    }

    _limpiarMarcadores() {
        try {
            if (this.grupoMarcadores) {
                this.grupoMarcadores.clearLayers();
            }
            this.marcadores.forEach(marker => {
                if (marker && marker.remove) {
                    marker.remove();
                }
            });
            this.marcadores = [];
        } catch (error) {
            console.warn('Error limpiando marcadores:', error);
            this.marcadores = [];
        }
    }

    _initEventos() {
        // Evento del selector de provincias
        if (this.elementosDOM.provinciaSelect) {
            this.elementosDOM.provinciaSelect.addEventListener('change', (e) => {
                this._filtrarPorProvincia(e.target.value);
            });
        }

        // Redimensionar mapa
        const resizeHandler = UtilsMapa.debounce(() => {
            if (this.map && this.map.getContainer()) {
                this.map.invalidateSize();
            }
        }, 250);

        window.addEventListener('resize', resizeHandler);

        // Detectar cuando se regresa a la página
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.map) {
                setTimeout(() => {
                    this.map.invalidateSize();
                }, 200);
            }
        });

        // Detectar focus en la ventana
        window.addEventListener('focus', () => {
            if (this.map) {
                setTimeout(() => {
                    this.map.invalidateSize();
                }, 200);
            }
        });
    }

    // Métodos públicos para API externa
    centrarEnUbicacion(nombre) {
        const ubicacion = this.ubicaciones.find(u => u.nombre === nombre);
        if (ubicacion) {
            this._seleccionarLugar(ubicacion);
            return true;
        }
        return false;
    }

    obtenerUbicacionesPorProvincia(provincia) {
        return this.ubicaciones.filter(u => u.provincia === provincia);
    }
}

/* ==========================================
   INICIALIZACIÓN
   ========================================== */
// Esperar a que el DOM esté listo Y que se hayan cargado los scripts previos
document.addEventListener('DOMContentLoaded', () => {
    // Pequeño delay para asegurar que todos los scripts de la página se han cargado
    setTimeout(() => {
        try {
            window.mapaNutrien = new MapaNutrien();
        } catch (error) {
            console.error('Error crítico al inicializar mapa Nutrien:', error);
            if (typeof ErrorManagerMapa !== 'undefined') {
                ErrorManagerMapa.mostrar('Error crítico al cargar la aplicación del mapa');
            }
        }
    }, 500);
});

// Exportar para uso externo si es necesario
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MapaNutrien, UtilsMapa, CONFIG_MAPA };
}