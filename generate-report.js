const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } = require('docx');

// Read the markdown report
const reportPath = path.join(__dirname, 'PROJECT_REPORT.md');
const reportContent = fs.readFileSync(reportPath, 'utf8');

// Helper function to create styled text runs
function createText(text, options = {}) {
    return new TextRun({
        text: text,
        bold: options.bold || false,
        italics: options.italics || false,
        underline: options.underline || false,
        size: options.size || 22, // 22 = 11pt in half-points
        color: options.color || "000000",
        font: options.font || "Times New Roman"
    });
}

// Parse markdown content and create docx elements
function parseMarkdownToDocx(content) {
    const elements = [];
    const lines = content.split('\n');
    let inList = false;
    let listItems = [];
    let inTable = false;
    let tableRows = [];

    const flushList = () => {
        if (listItems.length > 0) {
            listItems.forEach(item => {
                elements.push(new Paragraph({
                    children: [createText("• " + item)],
                    indent: { left: 720 }, // 0.5 inch indent
                    spacing: { line: 360 } // 1.5 line spacing
                }));
            });
            listItems = [];
        }
        inList = false;
    };

    const flushTable = () => {
        if (tableRows.length > 0) {
            elements.push(new Paragraph({ children: [createText(" ")] })); // Spacer
            tableRows = [];
        }
        inTable = false;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines but keep them for spacing
        if (line === '') {
            flushList();
            flushTable();
            continue;
        }

        // Handle page breaks for major sections
        if (line.startsWith('# ') || line.startsWith('**') && line.includes('END OF')) {
            if (elements.length > 0) {
                elements.push(new Paragraph({ children: [new TextRun({ break: 1 })] }));
            }
        }

        // Main headings (H1)
        if (line.startsWith('# ') && !line.includes('TABLE OF CONTENTS')) {
            elements.push(new Paragraph({
                text: line.replace('# ', ''),
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { before: 480, after: 240 }
            }));
            continue;
        }

        // Sub-headings (H2)
        if (line.startsWith('## ')) {
            flushList();
            flushTable();
            elements.push(new Paragraph({
                text: line.replace('## ', ''),
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 360, after: 120 }
            }));
            continue;
        }

        // Sub-sub headings (H3)
        if (line.startsWith('### ')) {
            elements.push(new Paragraph({
                text: line.replace('### ', ''),
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 240, after: 120 }
            }));
            continue;
        }

        // Bold headings (used for sections like a., b., etc.)
        if (line.startsWith('**') && line.endsWith('**')) {
            flushList();
            elements.push(new Paragraph({
                children: [createText(line.replace(/\*\*/g, ''), { bold: true, size: 24 })],
                spacing: { before: 240, after: 120 }
            }));
            continue;
        }

        // Bold inline text
        if (line.includes('**') && !line.startsWith('**')) {
            const parts = line.split('**');
            const textRuns = parts.map((part, idx) => {
                return createText(part, { bold: idx % 2 === 1 });
            });
            elements.push(new Paragraph({
                children: textRuns,
                spacing: { line: 360 }
            }));
            continue;
        }

        // List items
        if (line.startsWith('- ') || line.startsWith('1. ') || line.startsWith('• ')) {
            inList = true;
            let itemText = line.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '');
            listItems.push(itemText);
            continue;
        }

        // Table rows (simple approach - skip complex tables)
        if (line.startsWith('|') && !line.startsWith('|---')) {
            flushList();
            // For simplicity, convert table rows to bullet points
            const cells = line.split('|').filter(c => c.trim());
            if (cells.length > 1) {
                const firstCell = cells[1].trim();
                if (firstCell && firstCell !== '-' && !firstCell.match(/^[-\s]+$/)) {
                    elements.push(new Paragraph({
                        children: [createText("• " + firstCell)],
                        spacing: { line: 240 }
                    }));
                }
            }
            continue;
        }

        // Regular paragraph text
        if (line.length > 0 && !line.startsWith('#') && !line.startsWith('|')) {
            flushList();
            flushTable();
            elements.push(new Paragraph({
                children: [createText(line)],
                spacing: { line: 360 }
            }));
        }
    }

    return elements;
}

// Create the document
const doc = new Document({
    sections: [{
        properties: {
            page: {
                margin: {
                    top: 1440,  // 1 inch
                    right: 1440,
                    bottom: 1440,
                    left: 1440
                }
            }
        },
        children: parseMarkdownToDocx(reportContent)
    }]
});

// Save the document
Packer.toBuffer(doc).then(buffer => {
    const outputPath = path.join(__dirname, 'SurveyBuilder_Project_Report.docx');
    fs.writeFileSync(outputPath, buffer);
    console.log('✅ DOCX file generated successfully!');
    console.log('Output: ' + outputPath);
}).catch(err => {
    console.error('Error generating DOCX:', err);
});