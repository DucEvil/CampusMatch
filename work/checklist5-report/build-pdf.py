from pathlib import Path
from xml.sax.saxutils import escape
from docx import Document
from docx.oxml.ns import qn
from docx.table import Table as DocxTable
from docx.text.paragraph import Paragraph as DocxParagraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Image
from reportlab.lib.utils import ImageReader

ROOT=Path('E:/CampusMatch')
OUT=ROOT/'output/pdf/Bao_cao_checklist_5_CampusMatch.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
for name,file in [('TNR','times.ttf'),('TNR-Bold','timesbd.ttf'),('TNR-Italic','timesi.ttf'),('TNR-BoldItalic','timesbi.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(Path('C:/Windows/Fonts')/file)))
pdfmetrics.registerFontFamily('TNR',normal='TNR',bold='TNR-Bold',italic='TNR-Italic',boldItalic='TNR-BoldItalic')

WIDTH=493.2
styles={
 'Normal':ParagraphStyle('Normal',fontName='TNR',fontSize=12,leading=15.2,spaceAfter=7,alignment=TA_JUSTIFY),
 'Title':ParagraphStyle('Title',fontName='TNR-Bold',fontSize=22,leading=27,spaceAfter=14,keepWithNext=True),
 'Subtitle':ParagraphStyle('Subtitle',fontName='TNR',fontSize=12,leading=15,spaceAfter=9,keepWithNext=True),
 'Heading 1':ParagraphStyle('H1',fontName='TNR-Bold',fontSize=16,leading=20,spaceBefore=7,spaceAfter=10,keepWithNext=True),
 'Heading 2':ParagraphStyle('H2',fontName='TNR-Bold',fontSize=13,leading=16,spaceBefore=8,spaceAfter=6,keepWithNext=True),
 'Caption':ParagraphStyle('Caption',fontName='TNR-Italic',fontSize=10.5,leading=13,spaceAfter=6,keepWithNext=True),
 'Small':ParagraphStyle('Small',fontName='TNR',fontSize=10.5,leading=13.2,spaceAfter=7),
 'Code':ParagraphStyle('Code',fontName='TNR',fontSize=10,leading=13,spaceAfter=4),
 'Math':ParagraphStyle('Math',fontName='TNR',fontSize=12,leading=18,spaceBefore=3,spaceAfter=9,alignment=TA_CENTER),
}

def clean(text):
    return text.replace('\u2011','-').replace('\u2013','-').replace('\u2014','-')

def rich(p):
    result=[]
    for r in p.runs:
        t=escape(clean(r.text)).replace('\n','<br/>')
        if not t:continue
        if r.bold:t=f'<b>{t}</b>'
        if r.italic:t=f'<i>{t}</i>'
        result.append(t)
    return ''.join(result)

doc=Document(ROOT/'docs/Bao_cao_kiem_thu_va_danh_gia_mo_hinh_CampusMatch.docx')
story=[]
math_index=0
equations=[
 'Score = 100 × (0,50C + 0,30T + 0,10L + 0,10M)',
 'Precision@3 = h / 3 &nbsp;&nbsp;&nbsp;&nbsp; Recall@3 = h / r',
 'DCG@3 = ∑<sub>i=1</sub><super>3</super> g<sub>i</sub> / log<sub>2</sub>(i + 1)<br/>NDCG@3 = DCG@3 / IDCG@3',
]
for el in doc.element.body:
    if el.tag==qn('w:p'):
        p=DocxParagraph(el,doc)
        if el.find('.//'+qn('w:br')+'[@'+qn('w:type')+'="page"]') is not None:
            story.append(PageBreak());continue
        if el.find('.//'+qn('m:oMath')) is not None:
            story.append(Paragraph(equations[math_index],styles['Math']));math_index+=1;continue
        if el.find('.//'+qn('w:drawing')) is not None:
            path=ROOT/'docs/evaluation-chart.png'
            iw,ih=ImageReader(str(path)).getSize()
            story.append(Image(str(path),width=WIDTH-10,height=(WIDTH-10)*ih/iw));story.append(Spacer(1,6));continue
        if not p.text.strip():continue
        name=p.style.name
        if name not in styles:
            name='Small' if all(r.font.size and r.font.size.pt<=10.5 for r in p.runs if r.text) else 'Normal'
        if any(r.font.name=='Consolas' for r in p.runs):name='Code'
        st=styles[name]
        text=rich(p)
        # Improve numbering legibility without changing section structure.
        for old,new in [('1 1 ','1.1 '),('2 1 ','2.1 '),('2 2 ','2.2 '),('3 1 ','3.1 '),('3 2 ','3.2 '),('3 3 ','3.3 '),('4 1 ','4.1 '),('4 2 ','4.2 '),('5 1 ','5.1 '),('5 2 ','5.2 '),('6 1 ','6.1 '),('6 2 ','6.2 '),('7 1 ','7.1 '),('7 2 ','7.2 '),('7 3 ','7.3 '),('7 4 ','7.4 '),('8 1 ','8.1 '),('8 2 ','8.2 ')]:
            if text.startswith(old):text=new+text[len(old):]
        story.append(Paragraph(text,st))
    elif el.tag==qn('w:tbl'):
        table=DocxTable(el,doc)
        data=[]
        for ri,row in enumerate(table.rows):
            vals=[]
            for cell in row.cells:
                size=10 if len(table.rows)>25 else 10.5
                cs=ParagraphStyle('Cell',fontName='TNR-Bold' if ri==0 else 'TNR',fontSize=size,leading=size*1.17,spaceAfter=0)
                vals.append(Paragraph(escape(clean(cell.text)).replace('\n','<br/>'),cs))
            data.append(vals)
        widths=[float(col.width)/914400*72 for col in table.columns]
        factor=WIDTH/sum(widths)
        t=Table(data,colWidths=[w*factor for w in widths],repeatRows=1,hAlign='LEFT')
        padding=2 if len(table.rows)>25 else 4
        t.setStyle(TableStyle([
            ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#E5EDF2')),
            ('GRID',(0,0),(-1,-1),.35,colors.HexColor('#C5CDD2')),
            ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
            ('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),
            ('TOPPADDING',(0,0),(-1,-1),padding),('BOTTOMPADDING',(0,0),(-1,-1),padding),
        ]))
        story.extend([t,Spacer(1,8)])

def footer(canvas,doc):
    canvas.saveState();canvas.setFont('TNR',9);canvas.setFillColor(colors.HexColor('#555555'))
    canvas.drawRightString(552.6,24,f'CampusMatch TH3  |  Trang {doc.page}')
    canvas.restoreState()

pdf=SimpleDocTemplate(str(OUT),pagesize=(612,792),rightMargin=59.4,leftMargin=59.4,topMargin=44,bottomMargin=43,
    title='Báo cáo kiểm thử hệ thống và đánh giá mô hình gợi ý việc làm',author='Nhóm thực hiện CampusMatch')
pdf.build(story,onFirstPage=footer,onLaterPages=footer)
print(OUT)

from pypdf import PdfReader
reader=PdfReader(OUT)
print('Pages:',len(reader.pages))
texts=[p.extract_text() for p in reader.pages]
for i,text in enumerate(texts,1):
    print(i,len(text),text[:105].replace('\n',' | '))
alltext='\n'.join(texts)
assert '69/69' in alltext and '0,9412' in alltext
assert all(f'CORE{i:02}' in alltext for i in range(1,33))
assert all(f'API{i:02}' in alltext for i in range(1,19))
assert all(f'AI{i:02}' in alltext for i in range(1,20))
(ROOT/'work/checklist5-report/pdf-text.txt').write_text(alltext,encoding='utf-8')
