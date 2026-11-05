from pathlib import Path
import json, statistics
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path('E:/CampusMatch')
WORK=ROOT/'work/checklist5-report'
EVIDENCE=ROOT/'docs/checklist5-evidence'
S=json.loads((EVIDENCE/'validation-summary.json').read_text(encoding='utf-8'))
E=json.loads((EVIDENCE/'evaluation.json').read_text(encoding='utf-8'))
F=json.loads((ROOT/'data/fixtures.json').read_text(encoding='utf-8'))
OUT=ROOT/'docs/Bao_cao_kiem_thu_va_danh_gia_mo_hinh_CampusMatch.docx'
roles={'frontend':'Frontend','data':'Phân tích dữ liệu','backend':'Backend','content':'Content Marketing'}

doc=Document()
sec=doc.sections[0]
sec.page_width=Inches(8.5); sec.page_height=Inches(11)
sec.top_margin=Inches(.7); sec.bottom_margin=Inches(.65)
sec.left_margin=Inches(.85); sec.right_margin=Inches(.8)
sec.footer_distance=Inches(.27)
WIDTH=6.85
for name in ['Normal','Title','Subtitle','Heading 1','Heading 2','Heading 3','Caption']:
    st=doc.styles[name]
    st.font.name='Times New Roman'; st.font.color.rgb=RGBColor(0,0,0)
    st.element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'),'Times New Roman')
normal=doc.styles['Normal']; normal.font.size=Pt(12)
normal.paragraph_format.line_spacing=1.12
normal.paragraph_format.space_after=Pt(6)
for name,size in [('Title',22),('Subtitle',12),('Heading 1',16),('Heading 2',13),('Heading 3',12)]:
    st=doc.styles[name]; st.font.size=Pt(size); st.font.bold=name!='Subtitle'
    st.paragraph_format.space_before=Pt(10 if name!='Title' else 0)
    st.paragraph_format.space_after=Pt(7)
    st.paragraph_format.keep_with_next=True
doc.styles['Caption'].font.size=Pt(10.5)
doc.styles['Caption'].paragraph_format.space_after=Pt(7)
doc.styles['Caption'].paragraph_format.keep_with_next=True
for st in ['Normal','Title','Subtitle','Heading 1','Heading 2','Heading 3','Caption']:
    rp=doc.styles[st].element.get_or_add_rPr()
    for color in list(rp.findall(qn('w:color'))):
        color.attrib.pop(qn('w:themeColor'),None)
footer=sec.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT
run=footer.add_run('CampusMatch TH3   |   Trang ');run.font.size=Pt(9)
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE')
footer._p.append(field)
doc.core_properties.title='Báo cáo kiểm thử hệ thống và đánh giá mô hình gợi ý việc làm'
doc.core_properties.subject='Checklist 5 của CampusMatch TH3'
doc.core_properties.author='Nhóm thực hiện CampusMatch'

def p(text='',bold=False,style=None,small=False):
    para=doc.add_paragraph(style=style)
    run=para.add_run(text);run.bold=bold
    if small:run.font.size=Pt(10.5)
    para.paragraph_format.widow_control=True
    return para

def h(text,level=1):return doc.add_heading(text,level)
def page(title):doc.add_page_break();h(title)
def bullet(text):
    para=p('• '+text)
    para.paragraph_format.left_indent=Inches(.14)
    para.paragraph_format.first_line_indent=Inches(-.12)
    return para

def table(headers,rows,widths=None,size=10.5):
    tab=doc.add_table(rows=1,cols=len(headers));tab.alignment=WD_TABLE_ALIGNMENT.CENTER
    tab.autofit=False
    widths=widths or [WIDTH/len(headers)]*len(headers)
    for col,w in zip(tab.columns,widths):col.width=Inches(w)
    all_rows=[headers]+rows
    for ri,vals in enumerate(all_rows):
        row=tab.rows[0] if ri==0 else tab.add_row()
        trPr=row._tr.get_or_add_trPr()
        cant=OxmlElement('w:cantSplit');trPr.append(cant)
        if ri==0:
            repeat=OxmlElement('w:tblHeader');trPr.append(repeat)
        for ci,(cell,val) in enumerate(zip(row.cells,vals)):
            cell.width=Inches(widths[ci]);cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            tcPr=cell._tc.get_or_add_tcPr()
            borders=OxmlElement('w:tcBorders')
            for edge in ['top','left','bottom','right']:
                e=OxmlElement('w:'+edge);e.set(qn('w:val'),'single');e.set(qn('w:sz'),'5');e.set(qn('w:color'),'D9D9D9');borders.append(e)
            tcPr.append(borders)
            mar=OxmlElement('w:tcMar')
            for edge,v in [('top',65),('bottom',65),('left',95),('right',95)]:
                e=OxmlElement('w:'+edge);e.set(qn('w:w'),str(v));e.set(qn('w:type'),'dxa');mar.append(e)
            tcPr.append(mar)
            if ri==0:
                shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'E5EDF2');tcPr.append(shade)
            para=cell.paragraphs[0];para.paragraph_format.space_after=Pt(0)
            para.paragraph_format.space_before=Pt(0);para.paragraph_format.line_spacing=1.04
            if ci>0 and len(str(val))<18:para.alignment=WD_ALIGN_PARAGRAPH.CENTER
            run=para.add_run(str(val));run.font.name='Times New Roman';run.font.size=Pt(size);run.bold=ri==0
            run.font.color.rgb=RGBColor(0,0,0)
    p('').paragraph_format.space_after=Pt(0)
    return tab

def mr(text):
    r=OxmlElement('m:r');t=OxmlElement('m:t');t.text=text;r.append(t);return r
def frac(num,den):
    f=OxmlElement('m:f');n=OxmlElement('m:num');d=OxmlElement('m:den')
    for e in num:n.append(e)
    for e in den:d.append(e)
    f.append(n);f.append(d);return f
def sub(base,index):
    s=OxmlElement('m:sSub');e=OxmlElement('m:e');v=OxmlElement('m:sub');e.append(mr(base));v.append(mr(index));s.append(e);s.append(v);return s
def math(*elements):
    para=doc.add_paragraph();para.alignment=WD_ALIGN_PARAGRAPH.CENTER
    para.paragraph_format.space_after=Pt(7)
    eq=OxmlElement('m:oMathPara');m=OxmlElement('m:oMath')
    for e in elements:m.append(e if not isinstance(e,str) else mr(e))
    eq.append(m);para._p.append(eq)

p('Báo cáo kiểm thử hệ thống và đánh giá mô hình gợi ý việc làm',style='Title')
p('CampusMatch TH3   |   Nội dung đáp ứng checklist số 5',style='Subtitle')
p('Ngày lập báo cáo 05 tháng 11 năm 2026',small=True)
p('Kết quả tổng quát',bold=True)
p(f'Hệ thống vượt qua {S["pass"]}/{S["total"]} ca kiểm thử tự động và kiểm tra TypeScript. Trên 8 CV test giả lập, mô hình kết hợp đạt Precision@3 và Recall@3 bằng 100%, NDCG@3 bằng 0,9412. Các kết quả xác nhận hành vi của bản mẫu và khả năng xếp hạng theo nhãn kịch bản; chưa đủ cơ sở khẳng định hiệu quả tuyển dụng trên dữ liệu thực tế.')
h('1 Mục tiêu và phạm vi')
p('Báo cáo đánh giá tính đúng đắn của các chức năng xử lý CV, ghép việc, quản lý ứng tuyển và thống kê BI, đồng thời đo chất lượng danh sách gợi ý so với hai phương pháp đối chứng. Các ca thử bao gồm tình huống hợp lệ, dữ liệu sai, ràng buộc nghiệp vụ và lỗi khi tích hợp Gemini.')
p('Phạm vi gồm đọc CV văn bản hoặc ảnh, xác nhận hồ sơ, chấm điểm và xếp hạng CV–JD, gửi đơn và chuyển trạng thái, cùng các phép tổng hợp dashboard. Việc phân tích bằng Gemini được kiểm tra tự động bằng phản hồi mô phỏng. Báo cáo không đo tỷ lệ trúng tuyển, dự báo lương, chất lượng OCR trên ảnh thực hay năng lực phục vụ đồng thời nhiều người.')
h('1 1 Môi trường tái lập',2)
table(['Thành phần','Cấu hình ghi nhận'],[
    ['Hệ điều hành',f'Windows {S["architecture"]}   phiên bản nhân {S["release"]}'],
    ['Node.js dùng cho lượt kiểm thử',S['node']],
    ['Mã mô hình',E['model_version']],
    ['Backend và dữ liệu thử','Handler REST và SQLite trong bộ nhớ, adapter D1'],
    ['Lệnh kiểm tra kiểu','TypeScript --noEmit'],
    ['Ngày tham chiếu cho xếp hạng',F['reference_date']],
],widths=[2.45,4.4])
p('Ngày tham chiếu 29/10/2026 được giữ cố định khi đánh giá thứ hạng để kết quả không đổi do tin tuyển dụng hết hạn theo thời gian. Đây là ngày của kịch bản dữ liệu, khác ngày lập báo cáo.',small=True)

page('2 Tập dữ liệu và cách chia tập')
p('Dữ liệu được tạo để mô phỏng quy trình tuyển dụng sinh viên. Các hồ sơ, doanh nghiệp, tin tuyển dụng và sự kiện đều là giả lập; không đại diện cho mẫu khảo sát thị trường lao động.')
table(['Đối tượng','Số lượng','Vai trò trong kiểm thử'],[
    ['Tin tuyển dụng JD',16,'Danh sách công việc để xếp hạng'],
    ['CV ứng viên',12,'4 validation và 8 test'],
    ['Doanh nghiệp',4,'Liên kết với tin tuyển dụng'],
    ['Đơn ứng tuyển ban đầu',40,'Kiểm tra nghiệp vụ và BI'],
    ['Sự kiện trạng thái',118,'Tính phễu theo lịch sử của đơn'],
    ['Bản ghi lương công bố',48,'Theo dõi lương trong 3 tháng'],
],widths=[2.45,.75,3.65])
h('2 1 Phân tách hồ sơ và tin tuyển dụng',2)
p('Bốn nhóm công việc gồm Frontend, Phân tích dữ liệu, Backend và Content Marketing. Mỗi nhóm có 4 tin tuyển dụng và 3 CV. Từ vựng cùng trọng số IDF được fit trên 12 JD train, mỗi nhóm 3 JD. Bốn tin J04, J08, J12 và J16 không tham gia bước fit.')
p('Tập validation gồm C01, C04, C07, C10. Tập test gồm C02, C03, C05, C06, C08, C09, C11, C12. CV và nhãn phù hợp không được dùng để fit IDF. Trọng số tính điểm được cố định, không tìm tối ưu trên tập test.')
p('Danh sách ứng viên được xếp hạng trên toàn bộ 16 tin, gồm cả 12 JD train và 4 JD ngoài tập fit. Vì vậy, đây là đánh giá trên hồ sơ được giữ riêng, không phải thử nghiệm cold-start hoàn toàn trên các tin mới.')
h('2 2 Nhãn mức độ phù hợp',2)
table(['Nhãn','Ý nghĩa','Cách dùng'],[
    ['0','Không liên quan','Tin không được gán nhãn riêng được xem là 0'],
    ['1','Liên quan thấp','Không tính là phù hợp trong Precision và Recall'],
    ['2','Phù hợp','Được tính là kết quả liên quan'],
    ['3','Rất phù hợp','Được tính là kết quả liên quan, gain cao hơn'],
],widths=[.65,1.85,4.35])
p('Nhãn do người thiết kế đặt theo kịch bản, chưa được chuyên gia tuyển dụng gán nhãn độc lập. Mỗi CV có đúng 3 tin mang nhãn từ 2 trở lên. Vì k = 3 và số tin phù hợp cũng bằng 3, Precision@3 và Recall@3 trùng nhau trên bộ dữ liệu này; hai giá trị không cung cấp hai bằng chứng độc lập.')

page('3 Mô hình gợi ý và chỉ số đánh giá')
h('3 1 Quy trình tính điểm',2)
p('Hệ thống chuẩn hóa văn bản, ánh xạ các tên gọi kỹ năng về dạng thống nhất, loại bỏ một số từ dừng và tạo đặc trưng unigram, bigram. TF dùng trọng số 1 + ln(tần suất); IDF có làm trơn theo số văn bản train. Vector được chuẩn hóa L2 trước khi tính cosine. Mô hình hiện có 175 đặc trưng.')
math('Score = 100 × (0,50C + 0,30T + 0,10L + 0,10M)')
p('Trong đó C là tỷ lệ kỹ năng yêu cầu mà ứng viên đáp ứng, T là cosine TF-IDF giữa CV và JD, L là mức khớp địa điểm, M là mức khớp hình thức làm việc. L và M nhận giá trị 0 hoặc 1; công việc Remote được xem là khớp địa điểm khi thông tin cần thiết đã có.')
p('Lịch làm là điều kiện lọc: mọi ngày công việc yêu cầu phải nằm trong các ngày ứng viên có thể làm. Tin đã đóng hoặc hết hạn bị loại. Tổng điểm chỉ được trả khi hồ sơ đã xác nhận, đủ dữ liệu và tin đủ điều kiện. Điểm được làm tròn một chữ số thập phân và không phải xác suất được tuyển.')
h('3 2 Chỉ số chất lượng danh sách',2)
math('Precision@3 = ',frac([mr('h')],[mr('3')]),'     Recall@3 = ',frac([mr('h')],[mr('r')]))
p('h là số tin trong ba vị trí đầu có nhãn từ 2 trở lên; r là tổng số tin phù hợp của hồ sơ. Kết quả cuối cùng là trung bình cộng theo 8 CV test, mỗi CV có trọng số bằng nhau.')
nary=OxmlElement('m:nary');pr=OxmlElement('m:naryPr');ch=OxmlElement('m:chr');ch.set(qn('m:val'),'∑');pr.append(ch);nary.append(pr)
for tag,value in [('sub','i = 1'),('sup','3')]:
    el=OxmlElement('m:'+tag);el.append(mr(value));nary.append(el)
expr=OxmlElement('m:e');expr.append(frac([sub('g','i')],[sub('log','2'),mr('(i + 1)')]));nary.append(expr)
math('DCG@3 = ',nary,'     NDCG@3 = ',frac([mr('DCG@3')],[mr('IDCG@3')]))
p('Gain gᵢ dùng trực tiếp nhãn 0–3, không dùng gain lũy thừa. IDCG là DCG của thứ tự lý tưởng trên cùng nhãn của hồ sơ. NDCG@3 nằm trong khoảng 0–1, phản ánh cả chất lượng lẫn thứ tự các tin phù hợp.')
h('3 3 Hai phương pháp đối chứng',2)
p('TF-IDF thuần xếp tất cả tin theo cosine, dùng cùng từ vựng và IDF với mô hình kết hợp. Baseline thứ tự mã tin xếp tăng dần theo mã J01–J16. Khi điểm bằng nhau, mã tin được dùng để phá hòa một cách xác định.')

page('4 Thiết kế và kết quả kiểm thử hệ thống')
p('Các ca thử được thực hiện trên môi trường phát triển. Những kiểm thử có ghi dữ liệu dùng SQLite trong bộ nhớ và adapter D1; không thao tác lên database ứng dụng đang sử dụng. Kiểm thử API gọi trực tiếp handler, không bao gồm mạng HTTP production.')
table(['Nhóm kiểm thử','Tổng','Đạt','Lỗi'],[
    ['Lõi xử lý CV ghép việc BI và dữ liệu',32,32,0],
    ['API nghiệp vụ',18,18,0],
    ['Gemini và ảnh CV với phản hồi mô phỏng',19,19,0],
    ['Tổng cộng',69,69,0],
],widths=[4.15,.9,.9,.9],size=11)
p('Kiểm tra TypeScript hoàn thành với mã thoát 0. Tỷ lệ đạt 100% là tỷ lệ các ca đã thực thi, không phải độ bao phủ toàn bộ mã nguồn và không phải độ chính xác của mô hình AI.')
h('4 1 Các tình huống kiểm thử tiêu biểu',2)
table(['Tình huống','Kỳ vọng và kết quả'],[
    ['CV rỗng hoặc vượt giới hạn','Từ chối dữ liệu; các ca tương ứng đạt'],
    ['JavaScript và Java','Nhận diện độc lập; không gộp sai kỹ năng'],
    ['Phủ định kỹ năng','Câu chưa biết Python không tạo kỹ năng Python'],
    ['Tin đóng hết hạn hoặc trùng lịch','Không trả tổng điểm phù hợp cho tin bị chặn'],
    ['Ứng tuyển trùng và giao dịch lỗi','Ngăn đơn trùng; hoàn tác đơn cùng sự kiện khi lỗi'],
    ['Sửa CV sau khi gửi đơn','Snapshot hồ sơ của đơn cũ được giữ nguyên'],
    ['Ảnh sai MIME hoặc vượt 5 MB','Từ chối trước khi gửi tới Gemini'],
    ['Quota timeout và phản hồi AI lỗi','Trả lỗi tương ứng; không lộ key qua dữ liệu lỗi'],
],widths=[2.6,4.25],size=10.5)
h('4 2 Phạm vi bằng chứng Gemini và BI',2)
p('Các ca Gemini dùng phản hồi giả lập để kiểm tra cấu trúc request, JSON schema, dẫn chứng kỹ năng, lỗi dịch vụ và tải ảnh. Một số ảnh thử chỉ là dữ liệu tối thiểu hoặc chữ ký định dạng, không phải tập ảnh CV có nhãn. Vì vậy, 19/19 ca đạt chưa chứng minh độ chính xác OCR, khả năng đọc hiểu CV thật hay độ ổn định API Google.')
p('Các kiểm thử BI xác nhận không đếm trùng ứng viên, phễu theo lịch sử giảm dần, bộ lọc cohort hoạt động, tập rỗng trả tỷ lệ null và lương USD hoặc theo giờ không bị trộn vào chuỗi VND/tháng. Danh mục đầy đủ 69 ca được trình bày trong các phụ lục.')

page('5 Kết quả đánh giá mô hình gợi ý')
p('Kết quả dưới đây được tái lập từ cùng fixture, cùng ngày tham chiếu và cùng chương trình đánh giá. Các chỉ số xếp hạng khớp với kết quả đã lưu trước đó trong dự án.')
table(['Phương pháp','Precision@3','Recall@3','NDCG@3'],[
    ['TF-IDF kết hợp kỹ năng và tiêu chí','100,00%','100,00%','0,9412'],
    ['TF-IDF cosine thuần','75,00%','75,00%','0,8037'],
    ['Baseline thứ tự mã tin','16,67%','16,67%','0,1937'],
],widths=[3.25,1.2,1.2,1.2],size=11)
p('Hình 1 So sánh NDCG tại ba vị trí đầu trên 8 CV test giả lập',style='Caption')
imgp=doc.add_paragraph();imgp.alignment=WD_ALIGN_PARAGRAPH.CENTER
imgp.add_run().add_picture(str(ROOT/'docs/evaluation-chart.png'),width=Inches(6.65))
p('Nguồn dữ liệu hình: data/evaluation.json. Hình làm tròn đến ba chữ số thập phân; bảng phía trên giữ bốn chữ số.',small=True)
h('5 1 Diễn giải kết quả',2)
p('Ở tập test, cả 24 vị trí trong 8 danh sách Top 3 đều có nhãn từ 2 trở lên. So với TF-IDF thuần, mô hình kết hợp tăng 25 điểm phần trăm Precision@3 và tăng 0,1375 NDCG@3. NDCG chưa bằng 1 cho thấy thứ tự giữa tin rất phù hợp và tin phù hợp chưa luôn trùng với thứ tự lý tưởng.')
p('Tập validation gồm 4 CV đạt Precision@3 = 100%, Recall@3 = 100% và NDCG@3 = 0,9299. Các giá trị này dùng để kiểm tra tính nhất quán của kịch bản; không thể suy ra mức cải thiện tỷ lệ phỏng vấn hoặc tỷ lệ được tuyển.')
h('5 2 Điều kiện so sánh',2)
p('Mô hình kết hợp sử dụng điều kiện lọc lịch, trạng thái và hạn tin, trong khi hai baseline trong chương trình hiện tại xếp toàn bộ tin mà không áp cùng bộ lọc. Vì vậy, mức chênh lệch thể hiện hiệu quả toàn bộ quy trình đang triển khai, chưa cô lập lợi ích của riêng thành phần kỹ năng hoặc trọng số. Cần thêm đối chứng cùng điều kiện lọc và thí nghiệm bỏ từng thành phần để kết luận nguyên nhân cải thiện.')

page('6 Kết quả theo hồ sơ và kiểm tra giao diện')
p('Mỗi hàng dưới đây tương ứng một CV test. Tên nhóm nghề được dùng để mô tả kịch bản; đây không phải biến dùng trực tiếp để cộng điểm trong công thức ghép việc.')
profile_map={c['id']:c for c in F['candidates']}
per=[]
for row in E['rows']:
    if row['split']!='test':continue
    top=row['recommendations'][0]
    per.append([row['candidate_id'],roles[profile_map[row['candidate_id']]['role']],top['job_id'],f"{top['score']:.1f}".replace('.',','),f"{row['hybrid']['ndcg']:.4f}".replace('.',',')])
table(['CV','Nhóm nghề','Tin đầu','Điểm khớp','NDCG@3'],per,widths=[.55,2.65,.8,1.25,1.1],size=11)
p('Precision@3 và Recall@3 đều bằng 100% cho từng CV trong bảng. Điểm khớp tin đầu được tính theo công thức nghiệp vụ 0–100; NDCG dùng nhãn kỳ vọng để đánh giá thứ tự danh sách. Hai đại lượng có ý nghĩa khác nhau.')
h('6 1 Ví dụ giải thích điểm',2)
p('Với C01 và J04 thuộc tình huống validation, hệ thống ghi nhận tổng điểm 97,9. Các thành phần xấp xỉ gồm 50 điểm kỹ năng, 27,9 điểm tương đồng văn bản, 10 điểm địa điểm và 10 điểm hình thức. Ví dụ cho thấy người dùng có thể kiểm tra nguồn gốc tổng điểm; không chứng minh xác suất tuyển dụng 97,9%.')
h('6 2 Bằng chứng giao diện đã lưu',2)
p('Tệp data/ui-test-results.json ghi nhận 5 kịch bản giao diện đã đạt: dashboard nhận dữ liệu qua API, đọc CV bỏ trạng thái xác nhận và hiện dẫn chứng, lưu hồ sơ tạo danh sách gợi ý, gửi đơn đổi trạng thái nút và xem giải thích điểm. Đây là bằng chứng lịch sử của bản mẫu, không phải lượt kiểm thử giao diện mới trong ngày lập báo cáo và không cộng vào 69 ca tự động.')
p('Số liệu 12 ứng viên, 16 tin, 40 đơn và tỷ lệ tuyển 15% trong bằng chứng giao diện là số liệu của bộ seed giả lập. Chúng mô tả dashboard hoạt động với dữ liệu API, không thể dùng làm tỷ lệ tuyển thực tế hoặc kết quả đánh giá mô hình gợi ý.')

page('7 Giới hạn và hướng cải tiến')
h('7 1 Giới hạn của kết quả',2)
for text in [
    'Quy mô nhỏ và nhãn tự đặt: 16 JD, 12 CV với cấu trúc tương đối đồng đều làm bài toán đơn giản hơn bối cảnh thực. Chưa có nhãn độc lập, đối chiếu chuyên gia hoặc dữ liệu ứng viên thật.',
    'Kỹ năng xác nhận trong fixture: đánh giá xếp hạng dùng kỹ năng đã có trong hồ sơ mẫu, không đo sai số trích xuất rồi truyền tiếp sang thứ hạng. Các chỉ số không đánh giá chất lượng Gemini hoặc OCR.',
    'Từ vựng giới hạn: TF-IDF chỉ học từ 12 JD và không hiểu đầy đủ ngữ nghĩa, kinh nghiệm, mức thành thạo hoặc các kỹ năng ngoài danh mục.',
    'Thiết kế đối chứng chưa đồng nhất: điều kiện lọc khác nhau giữa mô hình kết hợp và baseline. Chưa có ablation, kiểm định thống kê hoặc khoảng tin cậy.',
    'Kiểm thử chức năng chưa bao phủ mọi rủi ro: chưa đo coverage, tải đồng thời, đa trình duyệt, thiết bị di động thật, kiểm thử xâm nhập hoặc phân quyền đa doanh nghiệp.',
]:bullet(text)
h('7 2 Thời gian xử lý',2)
lat=E['latency_ms']
p(f'Lượt tái lập ghi nhận trung vị {lat["median"]:.3f} ms và lớn nhất {lat["max"]:.3f} ms cho việc tính danh sách 16 tin, đo một lần cho mỗi trong 12 CV. Phép đo dùng performance.now trong một tiến trình Node.js, sau khi fit mô hình. Các giá trị không bao gồm truy vấn HTTP, database, tải ảnh, mạng hoặc Gemini, và không phải cam kết thời gian phản hồi production.'.replace(f'{lat["median"]:.3f}',f'{lat["median"]:.3f}'.replace('.',',')).replace(f'{lat["max"]:.3f}',f'{lat["max"]:.3f}'.replace('.',',')))
h('7 3 Công việc cải tiến ưu tiên',2)
p('Ưu tiên bổ sung tập CV và JD đa dạng có đồng ý sử dụng, gán nhãn bởi ít nhất hai người đánh giá và giữ riêng tập test. Sau đó áp cùng điều kiện lọc cho các baseline, đo ảnh hưởng của từng thành phần điểm và đánh giá end-to-end từ CV hoặc ảnh đến danh sách việc làm. Độ trễ API, độ chính xác OCR và khả năng phục vụ đồng thời cần các bộ đo riêng.')
h('7 4 Kết luận',2)
p('CampusMatch đáp ứng việc kiểm thử trên dữ liệu mẫu và cung cấp kết quả đánh giá mô hình có thể tái lập. Lượt kiểm thử ghi nhận 69/69 ca đạt, TypeScript đạt và mô hình kết hợp đứng đầu các phương pháp đang so sánh trên tập test giả lập. Kết quả phù hợp để minh họa và kiểm chứng bản mẫu học phần; việc khẳng định hiệu quả tuyển dụng ngoài thực tế cần thêm dữ liệu độc lập và các phép đánh giá bổ sung.')

page('8 Hướng dẫn tái lập và hồ sơ bằng chứng')
p('Tại thư mục gốc CampusMatch, dùng Node.js từ 22.13 trở lên và phiên bản pnpm được ghim trong package.json. Các lệnh dưới đây chạy kiểm thử cục bộ; không cần API key Gemini thật cho bộ kiểm thử tự động.')
commands=[
    'pnpm install --frozen-lockfile',
    'node --test tests/core.test.mjs',
    'node --loader ./tests/ts-loader.mjs --test tests/api.test.mjs',
    'node --loader ./tests/ts-loader.mjs --test tests/cv-analysis.test.mjs',
    'node tests/evaluate.mjs',
    'pnpm exec tsc --noEmit',
]
for c in commands:
    para=p(c);para.paragraph_format.space_after=Pt(4)
    for r in para.runs:r.font.name='Consolas';r.font.size=Pt(9)
p('Có thể dùng pnpm test để chạy gộp ba bộ kiểm thử. Lệnh tests/evaluate.mjs ghi lại data/model.json và data/evaluation.json; các chỉ số xếp hạng cần khớp bảng trong báo cáo, còn thời gian xử lý có thể thay đổi theo máy và lượt chạy. Việc chạy ứng dụng minh họa dùng pnpm run start hoặc start.cmd sau khi đã build và tạo database theo README.')
h('8 1 Nhật ký của lượt lập báo cáo',2)
p('Bộ bằng chứng tại docs/checklist5-evidence lưu nhật ký TAP của từng bộ thử, kết quả TypeScript, kết quả đánh giá riêng và mã SHA256 của các nguồn chính. Chương trình tái lập chỉ chuyển vị trí ghi kết quả đánh giá sang thư mục bằng chứng, giữ nguyên thuật toán trong tests/evaluate.mjs.')
table(['Tệp trong checklist5-evidence','Nội dung'],[
    ['validation-summary.json','Môi trường, tổng hợp 69 ca và SHA256 nguồn'],
    ['core.tap.log','32 ca lõi và ràng buộc dữ liệu'],
    ['api.tap.log','18 ca API nghiệp vụ'],
    ['gemini.tap.log','19 ca Gemini và ảnh với phản hồi mô phỏng'],
    ['typecheck.log','Kết quả kiểm tra TypeScript'],
    ['evaluation.json và model.json','Chỉ số từng CV và mô hình dùng để đánh giá'],
    ['evaluation.log','Tóm tắt đầu ra chương trình đánh giá'],
],widths=[3.05,3.8],size=10.5)
h('8 2 Nguồn triển khai được đối chiếu',2)
p('data/fixtures.json; lib/matching.mjs; lib/cv-analysis.ts; lib/cv-image-upload.ts; tests/core.test.mjs; tests/api.test.mjs; tests/cv-analysis.test.mjs; tests/evaluate.mjs; data/ui-test-results.json; README.md.',small=True)
p('Các nguồn trên thuộc cùng dự án CampusMatch. Bằng chứng giao diện được ghi nhận riêng với kiểm thử handler và không được diễn giải thành kiểm thử HTTP production.',small=True)

for suite,prefix,title in [
    (S['suites'][0],'CORE','Phụ lục A Danh mục kiểm thử lõi'),
    (S['suites'][1],'API','Phụ lục B Danh mục kiểm thử API'),
    (S['suites'][2],'AI','Phụ lục C Danh mục kiểm thử Gemini và ảnh CV'),
]:
    page(title)
    p(f'Nguồn {suite["file"]}. Kết quả {suite["pass"]}/{suite["total"]} ca đạt, {suite["fail"]} ca lỗi. Mã ca dưới đây được đánh số theo thứ tự thực thi trong bộ thử.',small=True)
    rows=[[f'{prefix}{i:02}',c['name'],'Đạt'] for i,c in enumerate(suite['cases'],1)]
    table(['Mã ca','Nội dung kiểm thử','Kết quả'],rows,widths=[.76,5.43,.66],size=9.5 if suite['id']=='core' else 10.5)
    if suite['id']=='gemini':
        p('Các trạng thái ảnh mờ, ảnh không phải CV và lỗi Google được mô phỏng trong kiểm thử. Việc ca thử đạt xác nhận cách hệ thống xử lý đầu ra và lỗi, không xác nhận khả năng thị giác của mô hình trên tập ảnh thật.',small=True)

doc.save(OUT)
print(OUT)
print('Paragraphs:',len(doc.paragraphs),'Tables:',len(doc.tables))
