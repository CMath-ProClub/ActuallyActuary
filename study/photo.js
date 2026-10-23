/* The photo shelf: the worksheet you are actually working from.

   Four ways in, because the two people using this are on different devices:
   a file picker, a drag and drop, a paste (which is how a screenshot arrives
   on a laptop), and the camera (which is how a worksheet arrives on a
   phone).

   Everything is downscaled on the way in. A modern phone camera produces a
   12 megapixel JPEG; nothing here needs more than about 1600px on the long
   edge, and the difference is roughly 6MB against 300KB per photo. That
   matters twice over: once for memory now, and once for the sync service
   later, which has a 2MB limit per bundle.

   Reading the maths OFF the photo is deliberately not here yet. When it
   lands it goes through the local model, and the transcription will be
   yours to correct before anything is solved. The typed box below each photo
   is that step, working today without the model: look at the picture, type
   the function, and the engine takes it from there. */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

function uid() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
}

/* Downscale to a data URL. PNG in, PNG out when it is small, because a
   screenshot of text re-encoded as JPEG looks smeared; photographs go to
   JPEG, where the saving is worth it. */
export function shrink(file, maxEdge = MAX_EDGE) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      const isPng = /png/i.test(file.type) && w * h < 1200 * 1200;
      resolve({
        dataUrl: isPng ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', JPEG_QUALITY),
        width: w,
        height: h,
        original: { width: img.width, height: img.height, bytes: file.size },
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file did not open as an image.'));
    };
    img.src = url;
  });
}

export function approximateBytes(dataUrl) {
  const comma = String(dataUrl || '').indexOf(',');
  if (comma < 0) return 0;
  return Math.round((dataUrl.length - comma - 1) * 0.75);
}

/* A shelf of photos with a note and a typed transcription against each. The
   caller supplies the DOM helper so this file stays free of app plumbing. */
export function createShelf({ h, mount, onUse, onChange }) {
  const items = [];
  const list = h('div', { class: 'shelf' });
  const empty = h('p', { class: 'muted small shelfempty' },
    'Nothing here yet. Drop an image, paste a screenshot, or use the buttons.');

  const status = h('p', { class: 'muted small', role: 'status' });

  function repaint() {
    list.innerHTML = '';
    if (!items.length) {
      list.appendChild(empty);
    } else {
      for (const item of items) list.appendChild(card(item));
    }
    if (typeof onChange === 'function') onChange(items);
  }

  function card(item) {
    const img = h('img', { class: 'shelfimg', src: item.dataUrl, alt: item.name || 'Your photo' });
    img.addEventListener('click', () => img.classList.toggle('big'));

    const transcript = h('input', {
      class: 'textinput math', type: 'text', value: item.transcript || '',
      placeholder: 'type the function, e.g. sin(3x^2)',
      'aria-label': 'What the problem says',
    });
    transcript.addEventListener('input', () => { item.transcript = transcript.value; });

    const use = h('button', { class: 'btn small', type: 'button' }, 'Use this');
    use.addEventListener('click', () => {
      if (typeof onUse === 'function') onUse(item, transcript.value);
    });

    const remove = h('button', { class: 'linkish small danger', type: 'button' }, 'Remove');
    remove.addEventListener('click', () => {
      const at = items.indexOf(item);
      if (at >= 0) items.splice(at, 1);
      repaint();
    });

    return h('figure', { class: 'shelfitem' }, [
      img,
      h('figcaption', {}, [
        h('div', { class: 'shelfrow' }, [transcript, use]),
        h('div', { class: 'shelfmeta' }, [
          h('span', { class: 'small muted', text: `${item.width}×${item.height}` }),
          remove,
        ]),
      ]),
    ]);
  }

  async function add(file) {
    if (!file || !/^image\//.test(file.type || '')) {
      status.textContent = 'That was not an image.';
      return null;
    }
    try {
      const shrunk = await shrink(file);
      const item = {
        id: uid(),
        name: file.name || 'photo',
        at: Date.now(),
        transcript: '',
        ...shrunk,
      };
      items.push(item);
      const saved = Math.max(0, item.original.bytes - approximateBytes(item.dataUrl));
      status.textContent = saved > 50000
        ? `Added, scaled down to ${item.width}×${item.height} (${Math.round(saved / 1024)}KB smaller).`
        : 'Added.';
      repaint();
      return item;
    } catch (err) {
      status.textContent = err.message || 'That file did not open.';
      return null;
    }
  }

  /* Inputs. The camera one carries capture="environment", which is what makes
     a phone open the back camera instead of the gallery. */
  const filePick = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  filePick.addEventListener('change', async () => {
    for (const f of [...filePick.files]) await add(f);
    filePick.value = '';
  });
  const cameraPick = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  cameraPick.addEventListener('change', async () => {
    for (const f of [...cameraPick.files]) await add(f);
    cameraPick.value = '';
  });

  const drop = h('div', { class: 'dropzone', tabindex: '0' }, [
    h('p', { class: 'dropline', text: 'Drop a photo or screenshot here' }),
    h('div', { class: 'cta' }, [
      h('button', { class: 'btn small ghost', type: 'button', onclick: () => filePick.click() }, 'Choose a file'),
      h('button', { class: 'btn small ghost', type: 'button', onclick: () => cameraPick.click() }, 'Take a photo'),
    ]),
    h('p', { class: 'small muted', text: 'Or press Ctrl+V with a screenshot copied.' }),
    filePick,
    cameraPick,
  ]);

  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  drop.addEventListener('dragover', (e) => { stop(e); drop.classList.add('over'); });
  drop.addEventListener('dragleave', (e) => { stop(e); drop.classList.remove('over'); });
  drop.addEventListener('drop', async (e) => {
    stop(e);
    drop.classList.remove('over');
    for (const f of [...(e.dataTransfer.files || [])]) await add(f);
  });

  /* Paste anywhere on the page, which is how a screenshot actually arrives.
     Removed again by destroy(), or it would keep firing on other screens. */
  const onPaste = async (e) => {
    const files = [...(e.clipboardData ? e.clipboardData.files : [])];
    if (!files.length) return;
    e.preventDefault();
    for (const f of files) await add(f);
  };
  document.addEventListener('paste', onPaste);

  mount.appendChild(drop);
  mount.appendChild(status);
  mount.appendChild(list);
  repaint();

  return {
    add,
    items: () => items,
    clear() { items.length = 0; repaint(); },
    destroy() { document.removeEventListener('paste', onPaste); },
  };
}

export default { createShelf, shrink, approximateBytes };
