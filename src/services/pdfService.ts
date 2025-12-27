import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

export interface NoteItem {
    id: number
    title: string
    content: string
    createdAt: Date
}

// Export note as PDF and upload to Google Drive
export const exportNoteToPDF = async (note: NoteItem): Promise<void> => {
    try {
        // Create a temporary div with only the note content
        const tempDiv = document.createElement('div')
        tempDiv.style.position = 'absolute'
        tempDiv.style.left = '-9999px'
        tempDiv.style.width = '800px'
        tempDiv.style.padding = '40px'
        tempDiv.style.backgroundColor = 'white'
        tempDiv.style.fontFamily = 'Arial, sans-serif'

        // Add only content with formatting preserved
        const contentEl = document.createElement('div')
        contentEl.innerHTML = note.content
        contentEl.style.fontSize = '14px'
        contentEl.style.lineHeight = '1.6'
        contentEl.style.color = '#000'
        contentEl.style.backgroundColor = 'transparent' // Fix background color issue
        tempDiv.appendChild(contentEl)

        document.body.appendChild(tempDiv)

        // Convert to canvas
        const canvas = await html2canvas(tempDiv, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
        })

        // Remove temp div
        document.body.removeChild(tempDiv)

        // Create PDF
        const pdf = new jsPDF('p', 'mm', 'a4')
        const imgWidth = 210 // A4 width in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width

        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight)

        // Convert PDF to blob
        const pdfBlob = pdf.output('blob')

        // Upload to Google Drive
        await uploadPDFToDrive(note.title, pdfBlob)
    } catch (error) {
        console.error('Error exporting to PDF:', error)
        throw error
    }
}

// Upload PDF to Google Drive (replace if exists)
const uploadPDFToDrive = async (noteTitle: string, pdfBlob: Blob): Promise<void> => {
    try {
        const fileName = `${noteTitle}.pdf`

        // Search for existing PDF
        const searchResponse = await window.gapi.client.drive.files.list({
            q: `name='${fileName}' and mimeType='application/pdf' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive',
        })

        // Delete all existing PDFs with same name
        if (searchResponse.result.files && searchResponse.result.files.length > 0) {
            for (const file of searchResponse.result.files) {
                await window.gapi.client.drive.files.delete({ fileId: file.id! })
            }
        }

        // Create new PDF
        const metadata = {
            name: fileName,
            mimeType: 'application/pdf',
        }

        const form = new FormData()
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
        form.append('file', pdfBlob)

        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${window.gapi.client.getToken().access_token}`,
            },
            body: form,
        })
    } catch (error) {
        console.error('Error uploading PDF to Drive:', error)
        throw error
    }
}
