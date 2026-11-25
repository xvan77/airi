import JSZip from 'jszip'

const DOCX_MAIN_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

/** Pulls plain text from a .docx file for the card-from-text compiler. */
export async function extractTextFromDocx(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const entry = zip.file('word/document.xml')
  if (!entry)
    throw new Error('docx_missing_document')
  const xml = await entry.async('string')
  if (typeof DOMParser === 'undefined')
    return extractTextFromDocxXmlWithRegex(xml)
  return extractTextFromDocxXmlWithDom(xml)
}

function extractTextFromDocxXmlWithDom(xml: string) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const paragraphs = [...doc.getElementsByTagNameNS(DOCX_MAIN_NS, 'p')]
  if (!paragraphs.length) {
    const runs = [...doc.getElementsByTagNameNS(DOCX_MAIN_NS, 't')]
    return runs.map(node => node.textContent ?? '').join('').trim()
  }
  return paragraphs.map((paragraph) => {
    const runs = [...paragraph.getElementsByTagNameNS(DOCX_MAIN_NS, 't')]
    return runs.map(node => node.textContent ?? '').join('')
  }).filter(line => line.trim()).join('\n').trim()
}

function extractTextFromDocxXmlWithRegex(xml: string) {
  const paragraphs = xml.split(/<w:p[\s>]/)
  return paragraphs.map((chunk) => {
    const matches = chunk.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)
    return [...matches].map(match => match[1] ?? '').join('')
  }).filter(line => line.trim()).join('\n').trim()
}

function extensionOf(file: File) {
  const name = file.name.trim().toLowerCase()
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1) : ''
}

/** Reads character notes from a text, markdown, or Word upload. */
export async function readCharacterMaterialFile(file: File): Promise<string> {
  const extension = extensionOf(file)
  if (extension === 'doc')
    throw new Error('legacy_doc_unsupported')
  if (extension === 'docx')
    return extractTextFromDocx(file)
  return file.text()
}
