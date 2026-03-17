/* Woo Checkout */
jQuery(document).ready(function() {
    function rcfwcRenderOrResetClassicWidgets() {
        if (typeof grecaptcha === 'undefined' || typeof grecaptcha.render !== 'function') {
            return;
        }

        jQuery('.g-recaptcha').each(function() {
            var recaptchaContainer = jQuery(this);
            var existingWidgetId = recaptchaContainer.attr('data-rcfwc-widget-id');
            var hasRenderedIframe = recaptchaContainer.find('iframe').length > 0;

            if (!existingWidgetId && !hasRenderedIframe) {
                try {
                    var newlyRenderedWidgetId = grecaptcha.render(this, {
                        sitekey: recaptchaContainer.attr('data-sitekey'),
                        theme: recaptchaContainer.attr('data-theme') || 'light'
                    });
                    recaptchaContainer.attr('data-rcfwc-widget-id', newlyRenderedWidgetId);
                } catch (error) {
                    // Ignore render timing errors during checkout fragment updates.
                }
                return;
            }

            if (existingWidgetId && typeof grecaptcha.reset === 'function') {
                try {
                    grecaptcha.reset(parseInt(existingWidgetId, 10));
                } catch (error) {
                    // Ignore stale widget IDs after checkout fragment replacement.
                }
            }
        });
    }

    rcfwcRenderOrResetClassicWidgets();

    jQuery(document.body).on('update_checkout updated_checkout applied_coupon_in_checkout removed_coupon_in_checkout checkout_error', function() {
        setTimeout(rcfwcRenderOrResetClassicWidgets, 0);
    });
});

/* Woo Checkout Block */
(function() {
    document.addEventListener('DOMContentLoaded', function() {
        // Global callbacks used by auto-rendered v2 widgets in the block checkout
        window.rcfwcRecaptchaCallback = function(token) {
            try {
                if (typeof wp !== 'undefined' && wp.data) {
                    wp.data.dispatch('wc/store/checkout').__internalSetExtensionData('rcfwc', { token: token });
                }
            } catch (e) {}
        };
        window.rcfwcRecaptchaExpired = function() {
            try {
                if (typeof wp !== 'undefined' && wp.data) {
                    wp.data.dispatch('wc/store/checkout').__internalSetExtensionData('rcfwc', { token: '' });
                }
            } catch (e) {}
        };

        // Try to render explicitly if needed once the blocks mount/update
        if (typeof wp !== 'undefined' && wp.data) {
            var unsubscribe = wp.data.subscribe(function() {
                var el = document.getElementById('g-recaptcha-woo-checkout');
                if (!el) {
                    return;
                }
                // If already rendered (has inner HTML/iframe), stop listening
                if (el.innerHTML && el.innerHTML.trim() !== '') {
                    unsubscribe && unsubscribe();
                    return;
                }
                // Render explicitly with callbacks if the API is ready
                if (typeof grecaptcha !== 'undefined' && typeof grecaptcha.render === 'function') {
                    try {
                        grecaptcha.render(el, {
                            sitekey: el.getAttribute('data-sitekey'),
                            callback: rcfwcRecaptchaCallback,
                            'expired-callback': rcfwcRecaptchaExpired
                        });
                    } catch (e) {
                        // Ignore if already rendered or API not ready
                    }
                    unsubscribe && unsubscribe();
                }
            }, 'wc/store/cart');
        }
    });
})();
