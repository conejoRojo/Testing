/**
 * js/script.js - Mapa Interactivo Provincias Argentinas
 * Arquitectura modular con mejor separación de responsabilidades
 */

'use strict';

/* ==========================================
   CONFIGURACIÓN Y CONSTANTES
   ========================================== */
const CONFIG = {
    // Configuración del mapa
    mapa: {
        centroArgentina: [-38.416097, -63.616672],
        zoomInicial: 5,
        zoomDetalle: 15,
        maxZoom: 18
    },
    
    // Rutas de archivos
    rutas: {
        datos: './datos/ubicaciones.json',
        imagenes: './imagenes/'
    },
    
    // Timeouts y delays
    tiempo: {
        timeoutFetch: 10000,
        delayPopup: 500,
        errorDisplay: 5000
    },
    
    // Colores por provincia
    coloresProvincia: {
        'Buenos Aires': '#007bff',
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
   SELECTORES DOM
   ========================================== */
const SELECTORES = {
    mapa: '#map',
    provinciaSelect: '#provinciaSelect',
    lugaresContenedor: '#lugares-contenedor',
    listaLugares: '#lista-lugares',
    controls: '.controls',
    lugarItem: '.lugar-item',
    lugarNombre: '.lugar-nombre'
};

/* ==========================================
   UTILIDADES
   ========================================== */
const Utils = {
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
            
            // Validar que los strings requeridos no estén vacíos
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
        const { latMin, latMax, lngMin, lngMax } = CONFIG.coordenadas;
        if (lat < latMin || lat > latMax || lng < lngMin || lng > lngMax) {
            console.warn(`Coordenadas fuera del rango de Argentina: ${lugar.nombre}`, lugar);
            return false;
        }

        // Normalizar campos opcionales vacíos
        lugar.descripcion = lugar.descripcion || 'Sin descripción disponible';
        lugar.direccion = lugar.direccion || 'Dirección no especificada';
        lugar.productos = Array.isArray(lugar.productos) ? lugar.productos : [];
        lugar.telefono = lugar.telefono || null;
        lugar.email = lugar.email || null;

        return true;
    },

    /**
     * Limpia y normaliza datos de ubicación
     */
    normalizarUbicacion(lugar) {
        // Crear copia para no mutar el original
        const ubicacionLimpia = { ...lugar };

        // Limpiar strings vacíos y convertir a null o valores por defecto
        if (!ubicacionLimpia.descripcion || ubicacionLimpia.descripcion.trim() === '') {
            ubicacionLimpia.descripcion = 'Sin descripción disponible';
        }

        if (!ubicacionLimpia.direccion || ubicacionLimpia.direccion.trim() === '') {
            ubicacionLimpia.direccion = 'Dirección no especificada';
        }

        // Limpiar productos vacíos
        if (!Array.isArray(ubicacionLimpia.productos)) {
            ubicacionLimpia.productos = [];
        }
        
        // Filtrar productos vacíos
        ubicacionLimpia.productos = ubicacionLimpia.productos.filter(p => 
            p && typeof p === 'string' && p.trim() !== ''
        );

        // Si no hay productos, agregar uno por defecto
        if (ubicacionLimpia.productos.length === 0) {
            ubicacionLimpia.productos = ['Servicios disponibles'];
        }

        // Limpiar contacto
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
        return CONFIG.coloresProvincia[provincia] || '#6c757d';
    },

    /**
     * Formatea productos para mostrar en lista
     */
    formatearProductos(productos, limite = 2) {
        if (!Array.isArray(productos) || productos.length === 0) {
            return 'Servicios disponibles';
        }
        
        const productosLimitados = productos.slice(0, limite);
        const texto = productosLimitados.join(', ');
        return productos.length > limite ? `${texto}...` : texto;
    }
};

/* ==========================================
   GESTOR DE ERRORES
   ========================================== */
const ErrorManager = {
    /**
     * Muestra error de forma no intrusiva
     */
    mostrar(mensaje, tipo = 'error') {
        console.error(mensaje);
        
        let errorContainer = document.getElementById('error-container');
        if (!errorContainer) {
            errorContainer = this._crearContenedorError();
        }

        const errorDiv = this._crearElementoError(mensaje, tipo);
        errorContainer.appendChild(errorDiv);

        // Auto-remover después del tiempo configurado
        setTimeout(() => {
            this._removerError(errorDiv);
        }, CONFIG.tiempo.errorDisplay);
    },

    _crearContenedorError() {
        const container = document.createElement('div');
        container.id = 'error-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: var(--z-error, 1000);
            max-width: 300px;
        `;
        document.body.appendChild(container);
        return container;
    },

    _crearElementoError(mensaje, tipo) {
        const errorDiv = document.createElement('div');
        errorDiv.className = `error ${tipo}`;
        errorDiv.style.animation = 'slideIn 0.3s ease-out';
        
        errorDiv.innerHTML = `
            <span>${Utils.escaparHtml(mensaje)}</span>
            <button type="button" aria-label="Cerrar error">&times;</button>
        `;

        // Botón de cerrar
        const closeBtn = errorDiv.querySelector('button');
        closeBtn.addEventListener('click', () => this._removerError(errorDiv));

        return errorDiv;
    },

    _removerError(errorDiv) {
        if (errorDiv.parentNode) {
            errorDiv.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 300);
        }
    }
};

/* ==========================================
   GESTOR DE DATOS
   ========================================== */
const DataManager = {
    /**
     * Carga datos desde el JSON con manejo de errores robusto
     */
    async cargarUbicaciones() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.tiempo.timeoutFetch);

            const response = await fetch(CONFIG.rutas.datos, {
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
                .map(ubicacion => Utils.normalizarUbicacion(ubicacion))
                .filter(ubicacion => {
                    const esValida = Utils.validarUbicacion(ubicacion);
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
const IconManager = {
    /**
     * Crea icono personalizado para marcador
     */
    crear(lugar) {
        // Usar imagen si está disponible y existe
        if (lugar.imagen) {
            return this._crearIconoImagen(lugar);
        }
        
        // Si no hay imagen específica, usar nutrien.png
        const lugarConIcono = { ...lugar, imagen: './imagenes/nutrien.png' };
        return this._crearIconoImagen(lugarConIcono);
        },

    _crearIconoImagen(lugar) {
    // Función para verificar si la imagen existe
        const verificarImagen = (url) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
                img.src = url;
            });
        };

        // Intentar usar la imagen específica, si falla usar nutrien.png
        const iconUrl = lugar.imagen || './imagenes/nutrien.png';
        
        return L.icon({
            iconUrl: iconUrl,
            iconSize: [32, 37],
            iconAnchor: [16, 37],
            popupAnchor: [0, -28],
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            shadowSize: [41, 41],
            className: 'marcador-personalizado'
        });
    },

    _crearIconoLetra(lugar) {
        const letra = lugar.nombre.charAt(0).toUpperCase();
        const color = Utils.obtenerColorProvincia(lugar.provincia);
        
        return L.divIcon({
            html: `<div class="icono-letra" style="
                background: ${color}; 
                color: white; 
                width: 25px; 
                height: 25px; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-size: 14px; 
                font-weight: bold;
                border: 2px solid white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                font-family: var(--fuente-principal);
            ">${letra}</div>`,
            iconSize: [25, 25],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12],
            className: 'marcador-letra'
        });
    }
};

/* ==========================================
   GESTOR DE POPUP
   ========================================== */
const PopupManager = {
    /**
     * Crea contenido HTML para popup
     */
    crearContenido(lugar) {
        const datos = this._procesarDatos(lugar);
        return this._construirHTML(datos);
    },

    _procesarDatos(lugar) {
        return {
            nombre: Utils.escaparHtml(lugar.nombre),
            provincia: Utils.escaparHtml(lugar.provincia),
            descripcion: Utils.escaparHtml(lugar.descripcion),
            direccion: Utils.escaparHtml(lugar.direccion),
            telefono: lugar.telefono ? Utils.escaparHtml(lugar.telefono) : null,
            email: lugar.email ? Utils.escaparHtml(lugar.email) : null,
            productos: this._procesarProductos(lugar.productos),
            color: Utils.obtenerColorProvincia(lugar.provincia)
        };
    },

    _procesarProductos(productos) {
        if (Array.isArray(productos)) {
            return productos.map(p => `• ${Utils.escaparHtml(p)}`).join('<br>');
        }
        return productos ? Utils.escaparHtml(productos) : '';
    },

    _construirHTML(datos) {
        let html = `
            <div class="popup-contenido">
                <h3 style="margin: 0 0 10px 0; color: ${datos.color};">
                    ${datos.nombre}
                </h3>
                <p style="margin: 5px 0; font-style: italic;">
                    <strong>📍 ${datos.provincia}</strong>
                </p>
                <p style="margin: 5px 0;">${datos.descripcion}</p>
                <p style="margin: 5px 0;">
                    <strong>🏠 Dirección:</strong> ${datos.direccion}
                </p>
        `;

        // Información de contacto con target="_blank" para evitar pérdida de referencia
        if (datos.telefono) {
            html += `<p style="margin: 5px 0;">
                <strong>📞 Teléfono:</strong> 
                <a href="tel:${datos.telefono}" target="_blank" rel="noopener" style="color: var(--color-primario);">
                    ${datos.telefono}
                </a>
            </p>`;
        }

        if (datos.email) {
            html += `<p style="margin: 5px 0;">
                <strong>✉️ Email:</strong> 
                <a href="mailto:${datos.email}" target="_blank" rel="noopener" style="color: var(--color-primario);">
                    ${datos.email}
                </a>
            </p>`;
        }

        // Resto del código igual...
        if (datos.productos) {
            html += `
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">
                    <strong>🛠️ Productos/Servicios:</strong>
                    <div style="margin-top: 5px; padding-left: 10px; line-height: 1.4;">
                        ${datos.productos}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }
};

/* ==========================================
   CLASE PRINCIPAL - MAPA INTERACTIVO
   ========================================== */
class MapaInteractivo {
    constructor() {
        this.map = null;
        this.marcadores = [];
        this.ubicaciones = [];
        this.grupoMarcadores = null;
        this.elementosDOM = {};
        
        this.init();
    }

    async init() {
        try {
            this._cachearElementosDOM();
            this._verificarPrerequisitos();
            this._initMapa();
            await this._cargarDatos();
            this._initEventos();
            
            console.log('Mapa interactivo inicializado correctamente');
        } catch (error) {
            console.error('Error inicializando el mapa:', error);
            ErrorManager.mostrar('Error al inicializar el mapa interactivo');
        }
    }

    _cachearElementosDOM() {
        for (const [nombre, selector] of Object.entries(SELECTORES)) {
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
            // Asegurar que el contenedor existe y está limpio
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
                center: CONFIG.mapa.centroArgentina,
                zoom: CONFIG.mapa.zoomInicial,
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
                maxZoom: CONFIG.mapa.maxZoom,
                subdomains: ['a', 'b', 'c'],
                crossOrigin: true
            }).addTo(this.map);

            this.grupoMarcadores = L.featureGroup().addTo(this.map);
        } catch (error) {
            console.error('Error inicializando mapa:', error);
            throw error;
        }
    }


    /**
     * Verifica si el mapa está en estado válido y lo reinicializa si es necesario
     */
    _verificarEstadoMapa() {
        try {
            // Verificar si el mapa existe y tiene un contenedor válido
            if (!this.map || !this.map.getContainer() || !this.map.getContainer().parentNode) {
                console.warn('Mapa en estado inválido, reinicializando...');
                this._reinicializarMapa();
                return false;
            }
            
            // Verificar si el contenedor tiene dimensiones
            const container = this.map.getContainer();
            if (container.offsetWidth === 0 || container.offsetHeight === 0) {
                console.warn('Contenedor del mapa sin dimensiones, invalidando tamaño...');
                setTimeout(() => {
                    if (this.map && this.map.getContainer()) {
                        this.map.invalidateSize();
                    }
                }, 100);
            }
            
            return true;
        } catch (error) {
            console.warn('Error verificando estado del mapa:', error);
            this._reinicializarMapa();
            return false;
        }
    }

    /**
     * Reinicializa completamente el mapa
     */
    _reinicializarMapa() {
        try {
            // Limpiar mapa existente si existe
            if (this.map) {
                try {
                    this.map.remove();
                } catch (e) {
                    console.warn('Error removiendo mapa:', e);
                }
                this.map = null;
                this.grupoMarcadores = null;
                this.marcadores = [];
            }
            
            // Reinicializar
            this._initMapa();
            if (this.ubicaciones && this.ubicaciones.length > 0) {
                this._crearMarcadores();
            }
            
            console.log('Mapa reinicializado correctamente');
        } catch (error) {
            console.error('Error reinicializando mapa:', error);
            ErrorManager.mostrar('Error al reinicializar el mapa');
        }
    }

    async _cargarDatos() {
        try {
            this.ubicaciones = await DataManager.cargarUbicaciones();
            this._poblarProvincias();
            this._crearMarcadores();
            this._actualizarListaLugares([]);
            
        } catch (error) {
            console.error('Error cargando datos:', error);
            ErrorManager.mostrar('Error al cargar los datos del mapa');
        }
    }

    _poblarProvincias() {
        if (!this.elementosDOM.provinciaSelect) {
            console.warn('Elemento select de provincias no encontrado');
            return;
        }

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
                const icono = IconManager.crear(lugar);
                const marker = L.marker(lugar.coordenadas, { 
                    icon: icono,
                    alt: lugar.nombre,
                    title: lugar.nombre
                });

                const popupContenido = PopupManager.crearContenido(lugar);
                
                marker.bindPopup(popupContenido, {
                    maxWidth: 320,
                    minWidth: 200,
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

    _actualizarListaLugares(ubicaciones) {
        const contenedor = this.elementosDOM.lugaresContenedor;
        if (!contenedor) return;

        if (!ubicaciones || ubicaciones.length === 0) {
            contenedor.innerHTML = '<p class="texto-ayuda">Seleccione una provincia para ver las ubicaciones</p>';
            return;
        }

        contenedor.innerHTML = '';
        
        ubicaciones.forEach((lugar, index) => {
            const item = this._crearItemLugar(lugar, index);
            contenedor.appendChild(item);
        });
    }

    _crearItemLugar(lugar, index) {
        const item = document.createElement('div');
        item.className = 'lugar-item';
        item.dataset.index = index;
        item.setAttribute('tabindex', '0');
        item.setAttribute('role', 'button');
        item.setAttribute('aria-label', `Seleccionar ${lugar.nombre}`);
        
        const productos = Utils.formatearProductos(lugar.productos);

        item.innerHTML = `
            <div class="lugar-nombre">${Utils.escaparHtml(lugar.nombre)}</div>
            <div class="lugar-direccion">📍 ${Utils.escaparHtml(lugar.direccion)}</div>
            <div class="lugar-productos">${Utils.escaparHtml(productos)}</div>
        `;

        // Eventos para mouse y teclado
        item.addEventListener('click', () => this._seleccionarLugar(lugar));
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this._seleccionarLugar(lugar);
            }
        });

        return item;
    }

    _seleccionarLugar(lugar) {
        const marcador = this.marcadores.find(m => 
            m.ubicacionData.nombre === lugar.nombre &&
            m.ubicacionData.coordenadas[0] === lugar.coordenadas[0] &&
            m.ubicacionData.coordenadas[1] === lugar.coordenadas[1]
        );

        if (marcador) {
            this.map.setView(lugar.coordenadas, CONFIG.mapa.zoomDetalle);
            marcador.openPopup();
            this._actualizarEstadoLista(lugar);
        }
    }

    _actualizarEstadoLista(lugarSeleccionado) {
        const items = document.querySelectorAll(SELECTORES.lugarItem);
        items.forEach(item => item.classList.remove('activo'));

        const itemActivo = Array.from(items).find(item => {
            const nombre = item.querySelector(SELECTORES.lugarNombre)?.textContent;
            return nombre === lugarSeleccionado.nombre;
        });

        if (itemActivo) {
            itemActivo.classList.add('activo');
            itemActivo.focus();
        }
    }

    _filtrarPorProvincia(provincia) {
        try {
            // Verificar estado del mapa antes de proceder
            if (!this._verificarEstadoMapa()) {
                return;
            }

            if (!provincia || provincia === '') {
                this._mostrarTodosMarcadores();
                this._actualizarListaLugares([]);
                return;
            }

            const ubicacionesFiltradas = this.ubicaciones.filter(u => 
                u.provincia && u.provincia.trim() === provincia.trim()
            );
            
            this._actualizarListaLugares(ubicacionesFiltradas);

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
                    }, CONFIG.tiempo.delayPopup);
                } catch (boundsError) {
                    console.warn('Error ajustando bounds, usando setView:', boundsError);
                    this.map.setView(ubicacionesFiltradas[0].coordenadas, CONFIG.mapa.zoomDetalle);
                }
            }

        } catch (error) {
            console.error('Error filtrando por provincia:', error);
            ErrorManager.mostrar('Error al filtrar ubicaciones');
        }
    }

    _mostrarTodosMarcadores() {
        try {
            if (!this._verificarEstadoMapa()) {
                return;
            }

            if (!this.grupoMarcadores) {
                this.grupoMarcadores = L.featureGroup().addTo(this.map);
            }

            this.grupoMarcadores.clearLayers();
            this.marcadores.forEach(marker => {
                this.grupoMarcadores.addLayer(marker);
            });
            this.map.setView(CONFIG.mapa.centroArgentina, CONFIG.mapa.zoomInicial);
        } catch (error) {
            console.error('Error mostrando todos los marcadores:', error);
            this._reinicializarMapa();
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

        // Redimensionar mapa con mejor debounce
        const resizeHandler = Utils.debounce(() => {
            if (this.map && this.map.getContainer()) {
                this.map.invalidateSize();
            }
        }, 250);

        window.addEventListener('resize', resizeHandler);

        // Detectar cuando se regresa a la página - MEJORADO
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(() => {
                    this._verificarEstadoMapa();
                }, 500); // Mayor delay para asegurar que el DOM esté listo
            }
        });

        // Detectar focus en la ventana - MEJORADO
        window.addEventListener('focus', () => {
            setTimeout(() => {
                this._verificarEstadoMapa();
            }, 300);
        });

        // NUEVO: Detectar cuando se hace clic en enlaces externos
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' && (e.target.href.startsWith('tel:') || e.target.href.startsWith('mailto:'))) {
                // Marcar que se va a abrir un enlace externo
                this._enlaceExternoAbierto = true;
                setTimeout(() => {
                    this._enlaceExternoAbierto = false;
                    this._verificarEstadoMapa();
                }, 1000);
            }
        });

        // Limpieza al cerrar
        window.addEventListener('beforeunload', () => {
            this._cleanup();
        });
    }

    _cleanup() {
        // Limpieza de recursos al cerrar
        if (this.map) {
            this.map.remove();
        }
    }

    // Métodos públicos para API externa
    agregarUbicacion(nuevaUbicacion) {
        if (!Utils.validarUbicacion(nuevaUbicacion)) {
            console.error('Ubicación inválida:', nuevaUbicacion);
            return false;
        }

        this.ubicaciones.push(nuevaUbicacion);
        this._poblarProvincias();
        this._crearMarcadores();
        return true;
    }

    obtenerUbicacionesPorProvincia(provincia) {
        return this.ubicaciones.filter(u => u.provincia === provincia);
    }

    centrarEnUbicacion(nombre) {
        const ubicacion = this.ubicaciones.find(u => u.nombre === nombre);
        if (ubicacion) {
            this._seleccionarLugar(ubicacion);
            return true;
        }
        return false;
    }
}

/* ==========================================
   INICIALIZACIÓN
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.mapaInteractivo = new MapaInteractivo();
    } catch (error) {
        console.error('Error crítico al inicializar:', error);
        ErrorManager.mostrar('Error crítico al cargar la aplicación');
    }
});

// Exportar para uso externo si es necesario
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MapaInteractivo, Utils, CONFIG };
}