/* Woo Checkout */
function rcfwcIsTruthyValue(value) {
    if (value === true || value === 1) {
        return true;
    }

    if (typeof value === 'string') {
        var normalizedValue = value.toLowerCase();
        return normalizedValue === '1' || normalizedValue === 'true' || normalizedValue === 'yes' || normalizedValue === 'on';
    }

    return false;
}

jQuery(document).ready(function() {
    var checkoutButtonSelector = '#place_order, .wc-block-components-checkout-place-order-button';
    var checkoutEventSelector = 'update_checkout updated_checkout applied_coupon_in_checkout removed_coupon_in_checkout checkout_error';

    function rcfwcGetCheckoutConfig() {
        return window.rcfwcCheckoutConfig || {};
    }

    function rcfwcShouldBlockSubmitFeatureRun() {
        var checkoutConfig = rcfwcGetCheckoutConfig();
        return rcfwcIsTruthyValue(checkoutConfig.blockSubmitUntilRecaptcha);
    }

    function rcfwcIsRecaptchaRequiredForCurrentCustomer() {
        var checkoutConfig = rcfwcGetCheckoutConfig();
        if (rcfwcIsTruthyValue(checkoutConfig.guestOnly) && rcfwcIsTruthyValue(checkoutConfig.isUserLoggedIn)) {
            return false;
        }
        return true;
    }

    function rcfwcGetSelectedPaymentMethod() {
        var selectedPaymentRadio = jQuery('input[name="payment_method"]:checked');
        return selectedPaymentRadio.length ? selectedPaymentRadio.val() : '';
    }

    function rcfwcIsSelectedPaymentMethodSkipped() {
        var checkoutConfig = rcfwcGetCheckoutConfig();
        var selectedPaymentMethod = rcfwcGetSelectedPaymentMethod();
        if (!selectedPaymentMethod || !Array.isArray(checkoutConfig.skippedPaymentMethods)) {
            return false;
        }
        return checkoutConfig.skippedPaymentMethods.indexOf(selectedPaymentMethod) !== -1;
    }

    function rcfwcHasAnyRecaptchaResponse() {
        var hasResponse = false;

        if (typeof grecaptcha !== 'undefined' && typeof grecaptcha.getResponse === 'function') {
            jQuery('.g-recaptcha').each(function() {
                var recaptchaContainer = jQuery(this);
                var existingWidgetId = recaptchaContainer.attr('data-rcfwc-widget-id');
                if (existingWidgetId !== undefined && existingWidgetId !== '') {
                    try {
                        if (grecaptcha.getResponse(parseInt(existingWidgetId, 10))) {
                            hasResponse = true;
                            return false;
                        }
                    } catch (error) {
                        // Ignore stale widget IDs during checkout refreshes.
                    }
                }
            });
        }

        if (hasResponse) {
            return true;
        }

        var tokenFieldValue = (jQuery('textarea[name="g-recaptcha-response"]').first().val() || '').trim();
        return tokenFieldValue !== '';
    }

    function rcfwcShouldBlockSubmitNow() {
        if (!rcfwcShouldBlockSubmitFeatureRun()) {
            return false;
        }
        if (!rcfwcIsRecaptchaRequiredForCurrentCustomer()) {
            return false;
        }
        if (rcfwcIsSelectedPaymentMethodSkipped()) {
            return false;
        }
        if (jQuery('.g-recaptcha').length === 0) {
            return false;
        }
        return !rcfwcHasAnyRecaptchaResponse();
    }

    function rcfwcShowRecaptchaNotice() {
        var checkoutConfig = rcfwcGetCheckoutConfig();
        var message = (checkoutConfig.messages && checkoutConfig.messages.completeRecaptcha) ? checkoutConfig.messages.completeRecaptcha : 'Please complete the reCAPTCHA challenge.';

        if (jQuery('.rcfwc-checkout-recaptcha-notice').length) {
            return;
        }

        var errorMarkup = '<ul class="woocommerce-error rcfwc-checkout-recaptcha-notice" role="alert"><li>' + message + '</li></ul>';
        var noticeContainer = jQuery('.woocommerce-notices-wrapper').first();

        if (noticeContainer.length) {
            noticeContainer.prepend(errorMarkup);
        } else {
            jQuery('form.checkout').first().prepend(errorMarkup);
        }
    }

    function rcfwcSetRecaptchaValidationState(isInvalid) {
        jQuery('.g-recaptcha').each(function() {
            var recaptchaContainer = jQuery(this);

            if (isInvalid) {
                recaptchaContainer.css({
                    border: '2px solid #dc2626',
                    borderRadius: '6px',
                    padding: '8px',
                    backgroundColor: '#fff5f5'
                });
                return;
            }

            recaptchaContainer.css({
                border: '',
                borderRadius: '',
                padding: '',
                backgroundColor: ''
            });
        });
    }

    function rcfwcUpdatePayPalSmartButtonsBlockState() {
        var paypalSmartButtonContainerSelector = '.paypal-buttons';

        if (!rcfwcShouldBlockSubmitFeatureRun()) {
            jQuery('.rcfwc-paypal-pointer-block-overlay').remove();
            return;
        }

        var shouldBlockPayPalPointerEvents = rcfwcShouldBlockSubmitNow();
        jQuery(paypalSmartButtonContainerSelector).each(function() {
            var payPalButtonsContainer = jQuery(this);

            if (!shouldBlockPayPalPointerEvents) {
                payPalButtonsContainer.children('.rcfwc-paypal-pointer-block-overlay').remove();
                return;
            }

            if (!payPalButtonsContainer.is(':visible')) {
                payPalButtonsContainer.children('.rcfwc-paypal-pointer-block-overlay').remove();
                return;
            }

            var blockPayPalIframeClicksOverlay = payPalButtonsContainer.children('.rcfwc-paypal-pointer-block-overlay');
            if (!blockPayPalIframeClicksOverlay.length) {
                blockPayPalIframeClicksOverlay = jQuery('<div>', {
                    class: 'rcfwc-paypal-pointer-block-overlay',
                    'aria-hidden': 'true'
                });
                payPalButtonsContainer.append(blockPayPalIframeClicksOverlay);
            }

            blockPayPalIframeClicksOverlay.css({
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 10000,
                cursor: 'not-allowed',
                background: 'transparent',
                boxSizing: 'border-box'
            });
        });
    }

    function rcfwcUpdateSubmitRequirementNote() {
        var checkoutConfig = rcfwcGetCheckoutConfig();
        var recaptchaRequiredMessage = (checkoutConfig.messages && checkoutConfig.messages.recaptchaRequired) ? checkoutConfig.messages.recaptchaRequired : 'reCAPTCHA is required before you can place your order.';
        var noteSelector = '.rcfwc-submit-recaptcha-note';
        var shouldShowNote = rcfwcShouldBlockSubmitFeatureRun()
            && rcfwcIsRecaptchaRequiredForCurrentCustomer()
            && !rcfwcIsSelectedPaymentMethodSkipped()
            && jQuery('.g-recaptcha').length > 0;

        if (!shouldShowNote) {
            jQuery(noteSelector).remove();
            return;
        }

        var noteMarkup = '<p class="rcfwc-submit-recaptcha-note" style="margin: 0 0 10px; font-size: 13px; color: #6b7280;">' + recaptchaRequiredMessage + '</p>';
        var classicButton = jQuery('#place_order').first();
        if (classicButton.length) {
            if (!classicButton.prev().is(noteSelector)) {
                jQuery(noteSelector).remove();
                classicButton.before(noteMarkup);
            }
            return;
        }

        var blockButton = jQuery('.wc-block-components-checkout-place-order-button').first();
        if (blockButton.length) {
            var blockButtonContainer = blockButton.closest('.wc-block-components-checkout-place-order');
            if (blockButtonContainer.length && blockButtonContainer.prev().is(noteSelector) === false) {
                jQuery(noteSelector).remove();
                blockButtonContainer.before(noteMarkup);
            }
        }
    }

    function rcfwcUpdatePlaceOrderButtonsState() {
        if (!rcfwcShouldBlockSubmitFeatureRun()) {
            rcfwcSetRecaptchaValidationState(false);
            rcfwcUpdateSubmitRequirementNote();
            rcfwcUpdatePayPalSmartButtonsBlockState();
            return;
        }

        var shouldBlockNow = rcfwcShouldBlockSubmitNow();
        jQuery(checkoutButtonSelector)
            .attr('aria-disabled', shouldBlockNow ? 'true' : 'false')
            .toggleClass('rcfwc-submit-blocked', shouldBlockNow)
            .css({
                opacity: shouldBlockNow ? '0.7' : '',
                cursor: shouldBlockNow ? 'not-allowed' : ''
            });
        if (!shouldBlockNow) {
            rcfwcSetRecaptchaValidationState(false);
        }
        rcfwcUpdateSubmitRequirementNote();
        rcfwcUpdatePayPalSmartButtonsBlockState();
    }

    function rcfwcRenderOrResetClassicWidgets() {
        if (typeof grecaptcha === 'undefined' || typeof grecaptcha.render !== 'function') {
            rcfwcUpdatePlaceOrderButtonsState();
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
                        theme: recaptchaContainer.attr('data-theme') || 'light',
                        callback: function() {
                            jQuery('.rcfwc-checkout-recaptcha-notice').remove();
                            rcfwcSetRecaptchaValidationState(false);
                            rcfwcUpdatePlaceOrderButtonsState();
                        },
                        'expired-callback': function() {
                            rcfwcUpdatePlaceOrderButtonsState();
                        }
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
        rcfwcUpdatePlaceOrderButtonsState();
    }

    rcfwcRenderOrResetClassicWidgets();

    jQuery(document).on('click', checkoutButtonSelector, function(event) {
        if (!rcfwcShouldBlockSubmitNow()) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        rcfwcSetRecaptchaValidationState(true);
        rcfwcShowRecaptchaNotice();
        rcfwcUpdatePlaceOrderButtonsState();
    });

    jQuery(document).on('submit', 'form.checkout', function(event) {
        if (!rcfwcShouldBlockSubmitNow()) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        rcfwcSetRecaptchaValidationState(true);
        rcfwcShowRecaptchaNotice();
        rcfwcUpdatePlaceOrderButtonsState();
    });

    jQuery(document.body).on(checkoutEventSelector, function() {
        setTimeout(function() {
            rcfwcRenderOrResetClassicWidgets();
            rcfwcUpdatePlaceOrderButtonsState();
        }, 0);
    });

    jQuery(document.body).on('change', 'input[name="payment_method"]', function() {
        setTimeout(rcfwcUpdatePlaceOrderButtonsState, 0);
    });

    jQuery(document).on('click', '.rcfwc-paypal-pointer-block-overlay', function(event) {
        if (!rcfwcShouldBlockSubmitNow()) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        rcfwcSetRecaptchaValidationState(true);
        rcfwcShowRecaptchaNotice();
    });

    window.rcfwcSyncPaypalButtonBlockingWithRecaptcha = rcfwcUpdatePayPalSmartButtonsBlockState;
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
            if (window.rcfwcCheckoutConfig && rcfwcIsTruthyValue(window.rcfwcCheckoutConfig.blockSubmitUntilRecaptcha)) {
                jQuery('.rcfwc-checkout-recaptcha-notice').remove();
                rcfwcSetRecaptchaValidationState(false);
                jQuery('#place_order, .wc-block-components-checkout-place-order-button')
                    .attr('aria-disabled', 'false')
                    .removeClass('rcfwc-submit-blocked')
                    .css({ opacity: '', cursor: '' });
                if (typeof window.rcfwcSyncPaypalButtonBlockingWithRecaptcha === 'function') {
                    window.rcfwcSyncPaypalButtonBlockingWithRecaptcha();
                }
            }
        };
        window.rcfwcRecaptchaExpired = function() {
            try {
                if (typeof wp !== 'undefined' && wp.data) {
                    wp.data.dispatch('wc/store/checkout').__internalSetExtensionData('rcfwc', { token: '' });
                }
            } catch (e) {}
            if (window.rcfwcCheckoutConfig && rcfwcIsTruthyValue(window.rcfwcCheckoutConfig.blockSubmitUntilRecaptcha)) {
                jQuery('#place_order, .wc-block-components-checkout-place-order-button')
                    .attr('aria-disabled', 'true')
                    .addClass('rcfwc-submit-blocked')
                    .css({ opacity: '0.7', cursor: 'not-allowed' });
                if (typeof window.rcfwcSyncPaypalButtonBlockingWithRecaptcha === 'function') {
                    window.rcfwcSyncPaypalButtonBlockingWithRecaptcha();
                }
            }
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
