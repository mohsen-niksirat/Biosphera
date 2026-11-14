/**
 * Biosphera - Ecosystem File I/O
 * Portable .json snapshots of a whole biosphere plus CSV export of the
 * population history, so runs can be archived, shared or analysed offline.
 */

export class WorldIO {
  static _download(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoke on the next task so Safari has time to start the download
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  static _stamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  static downloadWorld(world, showToast) {
    try {
      const json = JSON.stringify(world.serializeState());
      WorldIO._download(
        `biosphera-gen${world.maxGeneration}-${WorldIO._stamp()}.json`,
        json,
        'application/json'
      );
      showToast?.('Ecosystem exported as a .json file.');
      return true;
    } catch (e) {
      console.error('World export failed:', e);
      showToast?.('Export failed: the ecosystem could not be serialized.');
      return false;
    }
  }

  /** Read and parse a picked file. Resolves { ok, state, error }. */
  static readWorldFile(file) {
    return new Promise((resolve) => {
      if (!file) {
        resolve({ ok: false, error: 'No file selected.' });
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => resolve({ ok: false, error: 'The file could not be read.' });
      reader.onload = () => {
        try {
          const state = JSON.parse(String(reader.result));
          resolve({ ok: true, state });
        } catch {
          resolve({ ok: false, error: 'This is not a valid Biosphera save file.' });
        }
      };
      reader.readAsText(file);
    });
  }

  static downloadCSV(chart, showToast) {
    try {
      const csv = chart?.csv?.();
      if (!csv) {
        showToast?.('No ecology history recorded yet.');
        return false;
      }
      WorldIO._download(
        `biosphera-ecology-${WorldIO._stamp()}.csv`,
        csv,
        'text/csv;charset=utf-8'
      );
      showToast?.('Ecology history exported as CSV.');
      return true;
    } catch (e) {
      console.error('CSV export failed:', e);
      showToast?.('CSV export failed.');
      return false;
    }
  }
}
