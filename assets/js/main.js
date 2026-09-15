/* Jaanson Advisory — site behaviour.
   Everything degrades gracefully: the site is fully readable with JS disabled. */
(function () {
  'use strict';

  /* ---- Mobile navigation ------------------------------------------------ */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('#site-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* ---- Header shadow once scrolled -------------------------------------- */
  var header = document.querySelector('.site-header');
  if (header) {
    var syncHeader = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    syncHeader();
    window.addEventListener('scroll', syncHeader, { passive: true });
  }

  /* ---- Reveal on scroll -------------------------------------------------- */
  var revealables = document.querySelectorAll('.reveal');
  if (revealables.length) {
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

      revealables.forEach(function (el) { observer.observe(el); });
    } else {
      revealables.forEach(function (el) { el.classList.add('is-visible'); });
    }
  }

  /* ---- Current year in the footer --------------------------------------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---- Contact form ------------------------------------------------------ */
  var form = document.querySelector('#enquiry-form');
  if (form) {
    var status = form.querySelector('.form-status');

    /* Pre-fill from a pricing link such as contact.html?package=growth */
    var PACKAGE_SERVICE = {
      starter: 'Business plan',
      growth: 'Business plan',
      funding: 'Grant or subsidy application'
    };
    var requested = new URLSearchParams(window.location.search).get('package');
    if (requested && PACKAGE_SERVICE[requested]) {
      var service = form.elements['service'];
      if (service) service.value = PACKAGE_SERVICE[requested];
      var message = form.elements['message'];
      if (message && !message.value) {
        message.value = 'I am interested in the ' +
          requested.charAt(0).toUpperCase() + requested.slice(1) + ' package.\n\n';
      }
    }

    var setStatus = function (message, isError) {
      if (!status) return;
      status.textContent = message;
      status.classList.add('is-visible');
      status.classList.toggle('is-error', Boolean(isError));
    };

    var markField = function (control, invalid) {
      var field = control.closest('.field, .checkbox');
      if (field) field.classList.toggle('is-invalid', invalid);
    };

    form.addEventListener('input', function (event) {
      var control = event.target;
      if (control.willValidate) markField(control, !control.checkValidity());
    });

    form.addEventListener('submit', function (event) {
      var controls = Array.prototype.slice.call(form.elements);
      var firstInvalid = null;

      controls.forEach(function (control) {
        if (!control.willValidate) return;
        var valid = control.checkValidity();
        markField(control, !valid);
        if (!valid && !firstInvalid) firstInvalid = control;
      });

      if (firstInvalid) {
        event.preventDefault();
        setStatus('Please check the highlighted fields and try again.', true);
        firstInvalid.focus();
        return;
      }

      event.preventDefault();

      var value = function (name) {
        var el = form.elements[name];
        return el ? String(el.value).trim() : '';
      };

      /* With a backend configured (see README), post the enquiry to it. */
      if (form.dataset.endpoint) {
        var button = form.querySelector('button[type="submit"]');
        if (button) button.disabled = true;
        setStatus('Sending your enquiry…');

        fetch(form.dataset.endpoint, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' }
        }).then(function (response) {
          if (!response.ok) throw new Error('Request failed');
          form.reset();
          setStatus('Thank you — your enquiry is on its way. We reply within one working day.');
        }).catch(function () {
          setStatus('Sorry, that did not go through. Please email hello@jaansonadvisory.com instead.', true);
        }).then(function () {
          if (button) button.disabled = false;
        });
        return;
      }

      /* No backend yet: compose an email so an enquiry is never silently lost. */
      {
        var body = [
          'Name: ' + value('name'),
          'Company: ' + value('company'),
          'Email: ' + value('email'),
          'Phone: ' + value('phone'),
          'Service: ' + value('service'),
          'Budget: ' + value('budget'),
          'Timeline: ' + value('timeline'),
          '',
          value('message')
        ].join('\n');

        setStatus('Opening your email app so you can send this enquiry…');
        window.location.href =
          'mailto:' + (form.dataset.mailto || 'hello@example.com') +
          '?subject=' + encodeURIComponent('Website enquiry — ' + (value('name') || 'new enquiry')) +
          '&body=' + encodeURIComponent(body);
      }
    });
  }

  /* ---- Scope estimator (business plans page) ----------------------------- */
  var estimator = document.querySelector('#estimator');
  if (estimator) {
    var priceOut = estimator.querySelector('[data-estimate-price]');
    var weeksOut = estimator.querySelector('[data-estimate-weeks]');
    var summaryOut = estimator.querySelector('[data-estimate-summary]');

    var BASE = {
      startup: { price: 1900, weeks: 2, label: 'Early-stage startup plan' },
      growth: { price: 3400, weeks: 3, label: 'Growth / expansion plan' },
      grant: { price: 4200, weeks: 4, label: 'Grant or subsidy application' },
      investor: { price: 5600, weeks: 5, label: 'Investor-grade plan and model' }
    };

    var EXTRAS = {
      model: { price: 1200, weeks: 1, label: '5-year financial model' },
      market: { price: 900, weeks: 1, label: 'Market and competitor research' },
      deck: { price: 800, weeks: 1, label: 'Investor pitch deck' },
      rush: { price: 0, weeks: 0, label: 'Priority delivery' }
    };

    var format = function (amount) {
      return '€' + amount.toLocaleString('en-US');
    };

    var recalc = function () {
      var type = estimator.querySelector('[name="plan-type"]:checked');
      var base = BASE[type ? type.value : 'startup'] || BASE.startup;
      var price = base.price;
      var weeks = base.weeks;
      var chosen = [base.label];

      estimator.querySelectorAll('[name="extra"]:checked').forEach(function (box) {
        var extra = EXTRAS[box.value];
        if (!extra) return;
        price += extra.price;
        weeks += extra.weeks;
        chosen.push(extra.label);
      });

      var rush = estimator.querySelector('[name="extra"][value="rush"]:checked');
      if (rush) {
        price = Math.round(price * 1.25 / 50) * 50;
        weeks = Math.max(1, Math.ceil(weeks * 0.6));
      }

      if (priceOut) priceOut.textContent = format(price) + ' – ' + format(Math.round(price * 1.3 / 50) * 50);
      if (weeksOut) weeksOut.textContent = weeks + '–' + (weeks + 1) + ' weeks';
      if (summaryOut) summaryOut.textContent = chosen.join(' · ');
    };

    estimator.addEventListener('change', recalc);
    recalc();
  }
})();
