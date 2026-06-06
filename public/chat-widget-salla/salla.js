(function () {
  if (document.getElementById('odheyati-salla-chat-widget')) return;

  const EMBED_URL = 'https://almotamed.com/embed';

  const chatSVG = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  const widget = document.createElement('div');
  widget.id = 'odheyati-salla-chat-widget';
  widget.innerHTML = `
    <button id="odheyati-salla-chat-launcher" aria-label="مساعد أضحيتي">${chatSVG}</button>
    <div id="odheyati-salla-chat-window">
      <div id="odheyati-salla-chat-header">
        <div style="direction:rtl">
          <div style="font-weight:700;font-size:15px">مساعد أضحيتي</div>
          <div style="font-size:12px;opacity:.85">نحن هنا لمساعدتك</div>
        </div>
        <button id="odheyati-salla-chat-close" aria-label="إغلاق">✕</button>
      </div>
      <iframe
        id="odheyati-salla-chat-frame"
        class="odheyati-salla-chat-frame"
        src=""
        data-src="${EMBED_URL}"
        allow="clipboard-write"
        loading="lazy"
      ></iframe>
    </div>
  `;

  document.body.appendChild(widget);

  const launcher = document.getElementById('odheyati-salla-chat-launcher');
  const chatWindow = document.getElementById('odheyati-salla-chat-window');
  const closeBtn = document.getElementById('odheyati-salla-chat-close');
  const frame = document.getElementById('odheyati-salla-chat-frame');

  let loaded = false;

  launcher.addEventListener('click', function () {
    chatWindow.classList.add('open');
    if (!loaded) {
      frame.src = frame.getAttribute('data-src');
      loaded = true;
    }
  });

  closeBtn.addEventListener('click', function () {
    chatWindow.classList.remove('open');
  });
})();