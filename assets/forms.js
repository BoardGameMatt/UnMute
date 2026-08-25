/* ============================================================
   UNMUTE — FORM DELIVERY
   ------------------------------------------------------------
   ONE THING TO CHANGE. Go to formspree.io, create a free form,
   point it at the address that should receive submissions, and
   paste the endpoint it gives you below. It looks like:

       https://formspree.io/f/abcdwxyz

   Formspree emails that address to confirm the first time a
   submission comes through. Until this is replaced, the forms
   will show an error instead of silently swallowing a lead.
   ============================================================ */

const UNMUTE_FORM_ENDPOINT = "https://formspree.io/f/REPLACE_ME";

/* ---------------------------------------------------------- */

(function () {
  var CONFIGURED = UNMUTE_FORM_ENDPOINT.indexOf("REPLACE_ME") === -1;

  function setStatus(form, message, kind) {
    var el = form.querySelector(".form-status");
    if (!el) {
      el = document.createElement("p");
      el.className = "form-status";
      form.appendChild(el);
    }
    el.textContent = message;
    el.setAttribute("data-kind", kind);
    el.setAttribute("role", "status");
  }

  function handle(form) {
    // Non-JS fallback: a plain POST still reaches Formspree.
    if (CONFIGURED) form.setAttribute("action", UNMUTE_FORM_ENDPOINT);
    form.setAttribute("method", "POST");

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (!CONFIGURED) {
        setStatus(form, "This form isn't connected yet. Set UNMUTE_FORM_ENDPOINT in assets/forms.js.", "error");
        return;
      }
      if (form.querySelector('input[name="_gotcha"]').value !== "") return; // bot

      var btn = form.querySelector('[type="submit"]');
      var label = btn ? btn.textContent : "";
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      setStatus(form, "", "");

      fetch(UNMUTE_FORM_ENDPOINT, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      })
        .then(function (res) {
          if (!res.ok) throw new Error("Bad response");
          var next = form.getAttribute("data-download");
          if (next) {
            setStatus(form, "On its way. Your download is starting now.", "ok");
            window.location.href = next;
          } else {
            setStatus(form, "Thanks — that's with us. We'll be in touch shortly.", "ok");
          }
          form.reset();
        })
        .catch(function () {
          setStatus(form, "Something went wrong sending that. Email us directly and we'll pick it up.", "error");
        })
        .finally(function () {
          if (btn) { btn.disabled = false; btn.textContent = label; }
        });
    });
  }

  document.querySelectorAll("form[data-unmute-form]").forEach(handle);
})();
