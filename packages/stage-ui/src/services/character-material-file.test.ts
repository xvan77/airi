import JSZip from 'jszip'

import { describe, expect, it } from 'vitest'

import { extractTextFromDocx, readCharacterMaterialFile } from './character-material-file'

describe('character-material-file', () => {
  it('extracts text from docx document.xml', async () => {
    const zip = new JSZip()
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}">
  <w:body>
    <w:p><w:r><w:t>Neuroverse</w:t></w:r></w:p>
    <w:p><w:r><w:t>Fan lore</w:t></w:r></w:p>
  </w:body>
</w:document>`)
    const blob = await zip.generateAsync({ type: 'blob' })
    const file = new File([blob], 'lore.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const text = await extractTextFromDocx(file)
    expect(text).toContain('Neuroverse')
    expect(text).toContain('Fan lore')
  })

  it('reads plain text files', async () => {
    const file = new File(['Hello card'], 'notes.txt', { type: 'text/plain' })
    await expect(readCharacterMaterialFile(file)).resolves.toBe('Hello card')
  })

  it('rejects legacy .doc files', async () => {
    const file = new File([new Uint8Array([0xD0, 0xCF])], 'old.doc', { type: 'application/msword' })
    await expect(readCharacterMaterialFile(file)).rejects.toThrow('legacy_doc_unsupported')
  })
})
