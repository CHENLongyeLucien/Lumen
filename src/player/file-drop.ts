// Opening files: the "Open a file" buttons and drag and drop anywhere on the page.

import { $, $as } from './utils';

export function initFileDrop({ onFiles }: { onFiles: (files: FileList) => void }): void {
  const fileInput = $as('#fileInput', HTMLInputElement);
  const dragOverlay = $('#dragOverlay');

  /* ---------- File picker ---------- */

  $('#btnOpenFile').addEventListener('click', () => {
    fileInput.click();
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files?.length) onFiles(fileInput.files);
    fileInput.value = '';
  });

  /* ---------- Drag and drop (whole page) ---------- */

  // dragenter/dragleave fire for every child element: count them to know when the drag really left.
  let dragDepth = 0;
  const hasFiles = (event: DragEvent): boolean => Boolean(event.dataTransfer?.types.includes('Files'));

  window.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    dragOverlay.hidden = false;
  });
  window.addEventListener('dragover', (event) => {
    if (!hasFiles(event) || !event.dataTransfer) return;
    event.preventDefault(); // required, otherwise Chrome navigates to the file
    event.dataTransfer.dropEffect = 'copy';
  });
  window.addEventListener('dragleave', (event) => {
    if (!hasFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dragOverlay.hidden = true;
  });
  window.addEventListener('drop', (event) => {
    if (!hasFiles(event) || !event.dataTransfer) return;
    event.preventDefault();
    dragDepth = 0;
    dragOverlay.hidden = true;
    if (event.dataTransfer.files.length) onFiles(event.dataTransfer.files);
  });
}
