# Dockerfile
FROM nginx:alpine

# Copia los archivos de la aplicación
COPY app /usr/share/nginx/html

# Copia el archivo de configuración personalizado
COPY nginx.conf /etc/nginx/conf.d/default.conf
