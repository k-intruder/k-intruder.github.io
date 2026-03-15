// export.js – 문서 내보내기 (PDF / HTML / DOCX)
// ──────────────────────────────────────────────────────────────────────
// 공개 함수:
//   getRenderedHtml()   – 렌더링된 HTML 문자열 반환
//   exportPDF()         – 브라우저 인쇄(PDF) 대화상자 열기
//   exportHTML()        – HTML 파일 다운로드
//   exportDOCX()        – DOCX 파일 다운로드 (docx.js CDN 사용)
//   toggleExportMenu()  – 내보내기 드롭다운 메뉴 토글
//   hideExportMenu()    – 내보내기 메뉴 닫기
// ──────────────────────────────────────────────────────────────────────

// ── Export functions ───────────────────────────────────────────────
  function getRenderedHtml() {
    if (!AppState.compiled) return '';
    try { return compiled(collect()); } catch(e) { return ''; }
  }

  function exportPDF() {
    hideExportMenu();
    const html = getRenderedHtml();
    if (!html) { toast('렌더링된 문서가 없습니다.','error'); return; }
    const win = window.open('','_blank','width=1000,height=800');
    win.document.write(html);
    win.document.close();
    win.onload = () => setTimeout(() => { win.focus(); win.print(); }, 600);
    toast('🖨️ 인쇄 창을 열었습니다. "PDF로 저장"을 선택하세요.','info',3000);
  }

  function exportHTML() {
    hideExportMenu();
    const html = getRenderedHtml();
    const name = (data.course_name||'교수설계가이드')+'_교수설계가이드.html';
    const blob = new Blob([html],{type:'text/html;charset=utf-8'});
    const a = Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:name});
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    toast('📄 HTML 파일 다운로드 완료!','success');
  }

  async function exportDOCX() {
    hideExportMenu();
    if (typeof docx === 'undefined') {
      toast('📝 DOCX 라이브러리 로딩 중...','info',2000);
      await loadDocxLib();
    }
    if (typeof docx === 'undefined') { toast('DOCX 라이브러리 로드 실패','error'); return; }
    try {
      const d = collect();
      const {Document,Paragraph,TextRun,Table,TableRow,TableCell,
              HeadingLevel,AlignmentType,WidthType,Packer,ShadingType,convertInchesToTwip} = docx;

      const h = (text,level) => new Paragraph({text,heading:level,spacing:{before:300,after:150}});
      const p = (text,bold=false) => new Paragraph({children:[new TextRun({text:text||'',bold,size:21})],spacing:{after:100}});
      const li = (text) => new Paragraph({children:[new TextRun({text:text||'',size:21})],bullet:{level:0},spacing:{after:80}});
      const br = () => new Paragraph({text:''});
      function strip(html) { const t=document.createElement('div');t.innerHTML=html||'';return t.textContent||''; }

      const iRow=(label,value)=>new TableRow({children:[
        new TableCell({children:[p(label,true)],width:{size:30,type:WidthType.PERCENTAGE},shading:{type:ShadingType.CLEAR,fill:'E8F4FD'}}),
        new TableCell({children:[p(value)],width:{size:70,type:WidthType.PERCENTAGE}})]});
      const iTable=rows=>new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:rows.map(([l,v])=>iRow(l,v))});
      const dRow=cols=>new TableRow({children:cols.map(c=>new TableCell({children:[p(c)]}))});
      const dTable=(headers,rows)=>new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[
        new TableRow({tableHeader:true,children:headers.map(h=>new TableCell({children:[p(h,true)],shading:{type:ShadingType.CLEAR,fill:'F0F7FF'}}))}),...rows.map(dRow)]});

      const children=[];
      // Cover
      children.push(
        new Paragraph({children:[new TextRun({text:d.course_name||'',bold:true,size:56,color:'0066CC'})],alignment:AlignmentType.CENTER,spacing:{before:2000,after:400}}),
        new Paragraph({children:[new TextRun({text:'교수설계가이드',bold:true,size:48,color:'0066CC'})],alignment:AlignmentType.CENTER,spacing:{after:400}}),
        new Paragraph({children:[new TextRun({text:'디지털 전환 기반 교육설계 매뉴얼',size:30,color:'555555'})],alignment:AlignmentType.CENTER,spacing:{after:1200}}),
        p(`발행일: ${d.publish_date||''}`),p(`적용 교과목: ${d.course_name||''} (${d.department||''})`),p(`핵심 키워드: ${d.keywords||''}`),br(),
      );
      // S1
      children.push(h('1. 교수학습지침서 개요',HeadingLevel.HEADING_1),
        h('1.3 적용 교과목',HeadingLevel.HEADING_2),
        iTable([['교과목명',`${d.course_name||''} (${d.course_name_en||''})`],['학과',d.department||''],['학기/학년',`${d.semester||''} / ${d.year||''}`],['담당교수',d.professor_name||''],['주교재',d.textbook||'']]),br());
      // S2
      children.push(h('2. 교과목 개요',HeadingLevel.HEADING_1),h('2.1 교과목 명세',HeadingLevel.HEADING_2),
        iTable([['교과목명',`${d.course_name||''} (${d.course_name_en||''})`],['이수구분/학점',`${d.course_type||''} / ${d.credits||''} (이론${d.theory_hours||''} / 실습${d.practice_hours||''})`],['대상학년',d.year||''],['NCS직무',d.ncs_job||''],['핵심역량',d.core_competency||'']]),
        h('2.2 교과목 특성',HeadingLevel.HEADING_2),p(d.course_description),
        h('2.3 학습목표',HeadingLevel.HEADING_2)
      );
      (d.learning_goals||[]).forEach((g,i)=>children.push(p(`${i+1}. ${g}`)));
      children.push(h('2.4 선수/후속 과목',HeadingLevel.HEADING_2),p(`선수: ${d.prerequisite||''}`),p(`후속: ${d.follow_up||''}`),br());
      // S4
      children.push(h('4. DX 기반 수업 설계',HeadingLevel.HEADING_1));
      if((d.smart_methods||[]).length){
        children.push(h('4.2 SMART 교육방법',HeadingLevel.HEADING_2));
        children.push(dTable(['교육방법','실행전략','활용도구'],(d.smart_methods||[]).map(m=>[m.method_name||'',strip(m.description||''),m.tools||''])));
      }
      if(d.integration_summary) children.push(p(`통합운영: ${d.integration_summary}`));
      // ADDIE removed per user request
      // S5
      if((d.digital_tools||[]).length){
        children.push(h('5. 디지털 도구',HeadingLevel.HEADING_1));
        children.push(dTable(['카테고리','도구명','특징','활용법'],(d.digital_tools||[]).map(t=>[t.category||'',t.name||'',t.description||'',strip(t.usage||'')])));
        children.push(br());
      }
      // S6
      children.push(h('6. 주차별 수업 운영 계획',HeadingLevel.HEADING_1));
      const weekRows=(d.weeks||[]).map(w=>[`${w.weekNum}주차${w.is_midterm?' (중간)':w.is_final?' (기말)':''} : ${w.topic}`,w.goal,w.content,w.tools,w.assessment]);
      children.push(dTable(['주차/주제','학습목표','학습내용','활용도구','평가방법'],weekRows),br());
      // S8
      children.push(h('8. 학습평가',HeadingLevel.HEADING_1),
        dTable(['평가항목','비율','내용','도구'],[
          ['출석',`${d.attendance_rate||''}%`,d.attendance_description||'',d.attendance_tool||''],
          ['중간고사',`${d.midterm_rate||''}%`,d.midterm_description||'',d.midterm_tool||''],
          ['기말고사',`${d.final_rate||''}%`,d.final_description||'',d.final_tool||''],
          ['과제/프로젝트',`${d.assignment_rate||''}%`,d.assignment_description||'',d.assignment_tool||'']]),br());
      // S11
      if((d.appendix_sections||[]).length){
        children.push(h('11. 부록',HeadingLevel.HEADING_1));
        (d.appendix_sections||[]).forEach((s,i)=>{children.push(h(`11.${i+1} ${s.section_title||''}`,HeadingLevel.HEADING_2));children.push(p(strip(s.section_content||'')));}); 
      }

      const doc=new Document({
        creator:d.professor_name||'',title:`${d.course_name||''} 교수설계가이드`,
        sections:[{properties:{page:{margin:{top:convertInchesToTwip(1),right:convertInchesToTwip(1),bottom:convertInchesToTwip(1),left:convertInchesToTwip(1)}}},children}]
      });
      const blob=await Packer.toBlob(doc);
      const name=(d.course_name||'교수설계가이드')+'_교수설계가이드.docx';
      const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:name});
      document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
      toast('📝 DOCX 파일 다운로드 완료!','success');
    } catch(e) {
      console.error(e);
      toast('DOCX 생성 오류: '+e.message,'error',4000);
    }
  }

  function loadDocxLib() {
    return new Promise((resolve)=>{
      if(typeof docx!=='undefined'){resolve();return;}
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/docx@8/build/index.min.js';
      s.onload=resolve; s.onerror=resolve;
      document.head.appendChild(s);
    });
  }