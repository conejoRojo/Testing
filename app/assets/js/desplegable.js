

                const toggle = document.getElementById('productosToggle');
                function isMobile() {
                    return window.innerWidth < 992; // Bootstrap breakpoint for md
                }
                toggle.addEventListener('click', function (e) {
                    if (!isMobile()) {
                    window.location.href = 'producto.html';
                    }
                    // En mobile, no hacemos nada — el colapso se maneja por Bootstrap
                });

                const serviciosToggle = document.getElementById('serviciosToggle');
                function isMobile() {
                    return window.innerWidth < 992; // breakpoint estándar Bootstrap 5
                }
                serviciosToggle.addEventListener('click', function (e) {
                    if (!isMobile()) {
                    window.location.href = 'servicios.html';
                    }
                    // En mobile no se redirige, y el submenu se despliega automáticamente gracias a Bootstrap
                });

                const nosotrosToggle = document.getElementById('nosotrosToggle');
                function isMobile() {
                    return window.innerWidth < 992; // Bootstrap md breakpoint
                }
                nosotrosToggle.addEventListener('click', function (e) {
                    if (!isMobile()) {
                    window.location.href = 'nosotros.html';
                    }
                    // En mobile, el submenú se despliega sin redirigir
                });
