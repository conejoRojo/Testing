<?php
// assets/php/config.php - Configuración de seguridad mejorada
if (!defined('CONTACT_SYSTEM')) {
    die('Acceso directo no permitido');
}

// Configuración de email (HOST CORREGIDO)
// Producción
//define('MAIL_TO', 'nutrien.las.comunica@nutrien.com');
//desarrollo
define('MAIL_TO', 'gastiarena@gmail.com');
//desarrollo
define('MAIL_FROM', 'no-reply@nutrienagsolutions.com.ar'); // Host correcto
define('MAIL_FROM_NAME', 'Nutrien');
define('MAIL_SUBJECT_PREFIX', 'Consulta desde el web: ');
define('SEND_COPY_TO_ADMIN', true);

// Configuración de seguridad
define('MAX_REQUESTS_PER_HOUR', 3);
define('MAX_REQUESTS_PER_DAY', 8);
define('SESSION_TIMEOUT', 3600);
define('CSRF_TOKEN_LIFETIME', 1800);

// Configuración de logs
define('LOG_FILE', __DIR__ . '/logs/contact.log');
define('LOG_MAX_SIZE', 5242880);

// Configuración de validación
define('MIN_MESSAGE_LENGTH', 15);
define('MAX_MESSAGE_LENGTH', 1500);
define('MAX_NAME_LENGTH', 80);
define('MAX_SUBJECT_LENGTH', 150);

// Headers de seguridad
define('SECURITY_HEADERS', [
    'X-Content-Type-Options: nosniff',
    'X-Frame-Options: DENY',
    'X-XSS-Protection: 1; mode=block',
    'Referrer-Policy: strict-origin-when-cross-origin',
    'Content-Security-Policy: default-src \'self\'',
    'Strict-Transport-Security: max-age=31536000; includeSubDomains',
    'Permissions-Policy: geolocation=(), microphone=(), camera=()'
]);

// Configuración honeypot
define('HONEYPOT_FIELD_NAME', 'website_url');
define('HONEYPOT_TIME_THRESHOLD', 1);

// CLASE PARA LISTAS DE SPAM Y DOMINIOS SOSPECHOSOS
class SpamConfig {
    
    // Lista de dominios sospechosos
    public static function getSuspiciousDomains() {
        return [
            // Servicios temporales más populares
            '10minutemail.com', '10minutemail.net', '10minutemail.org',
            'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org',
            'mailinator.com', 'mailinator.net', 'mailinator.org',
            'throwaway.email', 'temp-mail.org', 'temp-mail.io',
            'yopmail.com', 'yopmail.net', 'yopmail.fr',
            'maildrop.cc', 'emailondeck.com', 'getnada.com',
            
            // Servicios emergentes 2024-2025
            'tempmail.plus', 'minuteinbox.com', 'mohmal.com',
            'sharklasers.com', 'guerrillamailblock.com', 'pokemail.net',
            'spam4.me', 'mailnesia.com', 'mailcatch.com',
            'mailnator.com', 'email-fake.com', 'fakemailgenerator.com',
            'disposablemail.com', 'throwawaymailbox.com', 'tempinbox.com',
            
            // Servicios con alta rotación
            'burnermail.io', 'mailtemp.info', 'tempmail.io',
            'inboxkitten.com', 'tempm.com', 'tempmailo.com',
            'mailtemp.co', 'temp-mail.online', '20minutemail.com',
            'mailexpire.com', 'tempmail24.com', 'instantemailaddress.com',
            
            // Dominios comunes de prueba/falsos
            'example.com', 'test.com', 'fake.com', 'invalid.com',
            'dummy.com', 'sample.com', 'placeholder.com',
            
            // Servicios conocidos por spam
            'mail.ru', 'bk.ru', 'list.ru', 'inbox.ru',
            'gmx.com', 'web.de', 'live.com.mx'
        ];
    }
    
    // Lista de palabras spam
    public static function getSpamKeywords() {
        return [
            // Palabras financieras
            'viagra', 'casino', 'lottery', 'winner', 'congratulations',
            'bitcoin', 'crypto', 'investment', 'loan', 'debt',
            'money back', 'risk free', 'guarantee', 'no obligation',
            'earn money', 'make money', 'quick money', 'easy money',
            'free money', '100% free', 'no cost', 'no fee',
            
            // Urgencia y presión
            'act now', 'urgent', 'immediately', 'expires today',
            'limited time', 'hurry up', 'dont wait', 'last chance',
            'expires soon', 'final notice', 'time sensitive',
            'only today', 'while supplies last', 'limited offer',
            
            // Marketing agresivo
            'buy now', 'order now', 'click here', 'visit now',
            'subscribe now', 'join now', 'sign up now',
            'special promotion', 'exclusive offer', 'incredible deal',
            'amazing offer', 'unbelievable', 'revolutionary',
            
            // Salud y medicina
            'lose weight', 'weight loss', 'miracle cure', 'anti aging',
            'no prescription', 'cialis', 'pharmacy',
            'medical breakthrough', 'doctor approved', 'clinical study',
            
            // Tecnología sospechosa
            'hack', 'hacking', 'cracked', 'pirated', 'leaked',
            'exploit', 'bypass', 'cheat', 'bot', 'automated',
            
            // Frases en español
            'ganar dinero', 'dinero facil', 'sin costo', 'gratis',
            'oferta especial', 'oportunidad unica', 'promocion',
            'compra ahora', 'urgente', 'limitado', 'garantizado',
            
            // Contenido generado automáticamente
            'lorem ipsum', 'sample text', 'test message', 'asdf',
            'qwerty', '123456', 'password', 'admin'
        ];
    }
    
    // Patrones regex para detección avanzada
    public static function getSpamPatterns() {
        return [
            '/\b\d{1,3}%\s+(free|off|discount)\b/i',
            '/\$\d+\s*(million|billion|k)\b/i',
            '/\b(call|text)\s+\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/i',
            '/\b[A-Z]{3,}\s+[A-Z]{3,}\b/',
            '/[!]{3,}|[?]{3,}/',
            '/\bhttps?:\/\/[^\s]+\b.*\bhttps?:\/\/[^\s]+\b/i',
            '/\b(SEO|PPC|ROI|CTR|CPC)\b/i',
            '/\b\w+\.(tk|ml|ga|cf|club|top|online|site)\b/i'
        ];
    }
    
    // User Agents sospechosos
    public static function getSuspiciousUserAgents() {
        return [
            'curl', 'wget', 'python', 'bot', 'crawler', 'spider',
            'scraper', 'parser', 'extractor', 'harvester',
            'postman', 'httpie', 'insomnia'
        ];
    }
    
    // Países de alto riesgo
    public static function getHighRiskCountries() {
        return [
            'CN', 'RU', 'PK', 'BD', 'NG', 'IN', 'ID', 'VN', 'PH', 'MM'
        ];
    }
}
?>