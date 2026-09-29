"""
Script to generate realistic, professional sample module documents for BARUNA Academy.
Generates:
1. Quiz_and_Assessment_Answer_Key.pdf
2. Trainer_Guide_Instructional_Plan.pdf
3. Training_Evaluation_Form.pdf
4. Practical_Exercise_Maritime_English.pdf
"""

import os

def create_rich_pdf(filepath, title, subtitle, sections):
    page_w, page_h = 595, 842
    margin_x = 50
    margin_top = 780
    line_h = 15
    
    pages = []
    curr_lines = []
    y = margin_top
    
    def start_page():
        nonlocal y, curr_lines
        curr_lines = []
        y = margin_top
        # Top banner
        curr_lines.append('q 0.08 0.22 0.38 rg 50 802 495 2 re f Q')
        curr_lines.append('BT /F1 8 Tf 0.45 0.45 0.45 rg 50 812 Td (BARUNA ACADEMY - KEMENTERIAN KELAUTAN DAN PERIKANAN) Tj ET')

    def flush_page():
        nonlocal curr_lines
        # Bottom divider & footer
        curr_lines.append('q 0.82 0.82 0.82 rg 50 45 495 1 re f Q')
        curr_lines.append(f'BT /F1 7.5 Tf 0.5 0.5 0.5 rg 50 32 Td (Dokumen Resmi Modul Pelatihan BARUNA - Halaman {len(pages) + 1}) Tj ET')
        pages.append('\n'.join(curr_lines).encode('latin1'))

    start_page()
    
    # Document Title
    curr_lines.append(f'BT /F2 16 Tf 0.05 0.15 0.3 rg {margin_x} {y} Td ({title}) Tj ET')
    y -= 20
    curr_lines.append(f'BT /F1 10 Tf 0.2 0.5 0.6 rg {margin_x} {y} Td ({subtitle}) Tj ET')
    y -= 14
    curr_lines.append(f'q 0.2 0.5 0.6 rg {margin_x} {y} 495 1 re f Q')
    y -= 22
    
    for sec_title, sec_paragraphs in sections:
        if y < 140:
            flush_page()
            start_page()
            
        curr_lines.append(f'BT /F2 11.5 Tf 0.08 0.22 0.38 rg {margin_x} {y} Td ({sec_title}) Tj ET')
        y -= 16
        
        for p in sec_paragraphs:
            if y < 65:
                flush_page()
                start_page()
            safe_p = p.replace('(', '\\(').replace(')', '\\)')
            curr_lines.append(f'BT /F1 8.5 Tf 0.18 0.18 0.18 rg {margin_x} {y} Td ({safe_p}) Tj ET')
            y -= line_h
        y -= 10
        
    flush_page()
    
    total_pages = len(pages)
    page_obj_ids = [5 + 2*i for i in range(total_pages)]
    
    catalog = b'<< /Type /Catalog /Pages 2 0 R >>'
    kids_str = ' '.join(f'{pid} 0 R' for pid in page_obj_ids)
    pages_obj = f'<< /Type /Pages /Kids [{kids_str}] /Count {total_pages} >>'.encode('ascii')
    f1 = b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
    f2 = b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
    
    all_objs = [catalog, pages_obj, f1, f2]
    
    for i, p_stream in enumerate(pages):
        page_id = 5 + 2*i
        content_id = 6 + 2*i
        page_dict = f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_w} {page_h}] /Contents {content_id} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>'.encode('ascii')
        content_dict = f'<< /Length {len(p_stream)} >>\nstream\n'.encode('ascii') + p_stream + b'\nendstream'
        all_objs.append(page_dict)
        all_objs.append(content_dict)
        
    output = bytearray(b'%PDF-1.4\n')
    offsets = []
    for idx, obj in enumerate(all_objs, 1):
        offsets.append(len(output))
        output.extend(f'{idx} 0 obj\n'.encode('ascii'))
        output.extend(obj)
        output.extend(b'\nendobj\n')
        
    xref_offset = len(output)
    output.extend(b'xref\n0 ' + str(len(all_objs) + 1).encode('ascii') + b'\n0000000000 65535 f \n')
    for off in offsets:
        output.extend(f'{off:010d} 00000 n \n'.encode('ascii'))
    output.extend(b'trailer\n<< /Size ' + str(len(all_objs) + 1).encode('ascii') + b' /Root 1 0 R >>\nstartxref\n')
    output.extend(str(xref_offset).encode('ascii') + b'\n%%EOF\n')
    
    with open(filepath, 'wb') as f:
        f.write(output)
    print(f'Created: {os.path.basename(filepath)} ({total_pages} pages, {len(output)} bytes)')


out_dir = 'd:/fe-baruna/public/sample-module-files'
os.makedirs(out_dir, exist_ok=True)

# 1. QUIZ & ASSESSMENT WITH ANSWER KEY
create_rich_pdf(
    os.path.join(out_dir, 'Quiz_and_Assessment_Answer_Key.pdf'),
    'MINISTRY PROFESSIONAL ENGLISH PROGRAM',
    'Assessment Instrument & Official Answer Key (Passing Score: 70%)',
    [
        ('1. Assessment Protocol & Scoring Structure', [
            'Target Competency: Maritime English Communication for International Ministry Relations',
            'Total Questions: 10 Multiple-Choice + 2 Case-Based Practical Scenarios',
            'Passing Score: 70% (Minimum 70/100 points required for Course Completion Certificate)',
            'Time Limit: 45 Minutes | Mode: Digital Online Assessment'
        ]),
        ('2. Multiple-Choice Assessment Questions', [
            'Question 1: What is the formal international term for unauthorized maritime fishing?',
            '  [A] Uncontrolled and Unreported Fishing',
            '  [B] Illegal, Unreported, and Unregulated (IUU) Fishing',
            '  [C] Unauthorized Marine Exploitation',
            '  [D] High-Seas Trespassing Operation',
            '',
            'Question 2: In diplomatic protocol, how should an official meeting with foreign maritime delegates be opened?',
            '  [A] "Hey everyone, let us get straight to the fishing discussion."',
            '  [B] "Distinguished delegates, esteemed colleagues, on behalf of the Ministry, I warmly welcome you."',
            '  [C] "Greetings representatives, we have urgent problems to resolve today."',
            '  [D] "Welcome to our meeting room, please proceed to state your demands."',
            '',
            'Question 3: Which international convention defines the 200-nautical-mile Exclusive Economic Zone (EEZ)?',
            '  [A] IMO MARPOL 73/78',
            '  [B] SOLAS Convention 1974',
            '  [C] United Nations Convention on the Law of the Sea (UNCLOS 1982)',
            '  [D] FAO Code of Conduct for Responsible Fisheries',
            '',
            'Question 4: What is the accurate English phrasing when issuing an official radio warning to a foreign vessel?',
            '  [A] "Attention unknown vessel, you are navigating in our territorial waters without clearance."',
            '  [B] "Stop your boat immediately, you are doing illegal things here."',
            '  [C] "Foreign boat, turn around now or face severe consequences."',
            '  [D] "Attention boat, we do not allow you to stay in this ocean zone."'
        ]),
        ('3. Official Answer Key & Pedagogical Explanations', [
            'Answer 1: [B] Illegal, Unreported, and Unregulated (IUU) Fishing',
            '  Explanation: This is the globally standardized terminology established by FAO and UNCLOS.',
            'Answer 2: [B] "Distinguished delegates, esteemed colleagues, on behalf of the Ministry..."',
            '  Explanation: Standard diplomatic opening statement upholding formal decorum in ministerial dialogues.',
            'Answer 3: [C] UNCLOS 1982 (Article 57 explicitly establishes the 200 nautical mile breadth of the EEZ).',
            'Answer 4: [A] "Attention unknown vessel, you are navigating in our territorial waters without clearance."',
            '  Explanation: Uses Standard Marine Communication Phrases (SMCP) endorsed by the IMO.'
        ])
    ]
)

# 2. TRAINER GUIDE
create_rich_pdf(
    os.path.join(out_dir, 'Trainer_Guide_Instructional_Plan.pdf'),
    'TRAINER GUIDE & INSTRUCTIONAL PLAN',
    'Comprehensive Facilitator Handbook - Ministry Professional English Program',
    [
        ('1. Instructional Overview & Target Learning Outcomes', [
            'Module Code: MOD-ENG-KKP-01 | Estimated Duration: 8 Learning Hours (8 JP)',
            'Delivery Format: Self-Paced with Synchronous Virtual Mentoring Option',
            'Trainer Persona: Marine & Fisheries Bilateral Communication Specialist',
            'Key Objective 1: Participants master Standard Marine Communication Phrases (IMO SMCP).',
            'Key Objective 2: Participants draft diplomatic bilateral briefs and fisheries patrol summaries.',
            'Key Objective 3: Participants conduct confident English presentations in multilateral marine forums.'
        ]),
        ('2. Session Breakdown & Instructional Timeline', [
            'Session 1 (2 JP): Foundations of International Maritime Law & Terminology (UNCLOS, EEZ, TAC).',
            'Session 2 (2 JP): Diplomatic Correspondence & Bilateral Marine Protocol.',
            'Session 3 (2 JP): Simulated Vessel Inspection & Marine Radio Communication Scenarios.',
            'Session 4 (2 JP): Practical Scientific Presentation & Assessment Debriefing.'
        ]),
        ('3. Facilitation Guidelines & Active Learning Strategies', [
            '1. Simulated Radio Calls: Have learners pair up and practice issuing formal VHF channel 16 alerts.',
            '2. Document Drafting Drills: Provide raw Indonesian patrol logs and guide translation into diplomatic English.',
            '3. Formative Feedback: Ensure positive correction focusing on clarity and terminology accuracy.',
            '4. Platform Utilization: Encourage learners to repeat audio recordings and self-assess using provided rubrics.'
        ]),
        ('4. Assessment & Passing Criteria', [
            'Quiz Minimum Passing Mark: 70% on multiple choice and practical writing assessment.',
            'Certificate of Completion is automatically awarded once all resources are marked done and quiz is passed.'
        ])
    ]
)

# 3. EVALUATION FORM
create_rich_pdf(
    os.path.join(out_dir, 'Training_Evaluation_Form.pdf'),
    'TRAINING EVALUATION & FEEDBACK INSTRUMENT',
    'Kirkpatrick Level 1 Reaction & Quality Assurance Form',
    [
        ('1. Participant & Module Information', [
            'Participant Name / NIP: __________________________________________________',
            'Unit / Balai / Direktorat: ________________________________________________',
            'Course Title: Ministry Professional English Program (Marine & Fisheries Sector)',
            'Evaluation Date: ____________________ | Completion Status: [ ] Passed  [ ] In Progress'
        ]),
        ('2. Quantitative Evaluation (Scale: 1 = Strongly Disagree to 5 = Strongly Agree)', [
            '[Criteria A] Trainer & Content Quality:',
            '  1. The learning objectives were clearly explained and structured.         [1] [2] [3] [4] [5]',
            '  2. The trainer demonstrated deep expertise in maritime English topics.   [1] [2] [3] [4] [5]',
            '  3. The lesson handouts and presentation slides were highly informative.   [1] [2] [3] [4] [5]',
            '',
            '[Criteria B] Platform Usability & Resources:',
            '  4. The BARUNA Academy learning workspace was smooth and easy to navigate. [1] [2] [3] [4] [5]',
            '  5. Audio, video, and PDF download materials loaded without technical errors. [1] [2] [3] [4] [5]',
            '',
            '[Criteria C] Job Applicability & Value:',
            '  6. The skills learned are directly applicable to my daily ministry duties. [1] [2] [3] [4] [5]',
            '  7. I would strongly recommend this training module to other KKP staff.    [1] [2] [3] [4] [5]'
        ]),
        ('3. Qualitative Feedback & Constructive Comments', [
            'Question 1: What was the most impactful topic or practical exercise in this module?',
            'Answer: __________________________________________________________________________________',
            '',
            'Question 2: What suggestions do you have for improving future versions of this training?',
            'Answer: __________________________________________________________________________________'
        ])
    ]
)

# 4. PRACTICAL EXERCISE
create_rich_pdf(
    os.path.join(out_dir, 'Practical_Exercise_Maritime_English.pdf'),
    'PRACTICAL EXERCISE: DIPLOMATIC MARITIME BRIEF',
    'Hands-on Scenario: Drafting an Official International Fisheries Incident Report',
    [
        ('1. Scenario Background', [
            'Date: 28 September 2026 | Location: Natuna Sea, Indonesian Exclusive Economic Zone (EEZ)',
            'Patrol Vessel: KP Orca 05 intercepted an unidentified foreign fishing vessel (FV Blue Ocean 88)',
            'Operating Coordinates: 04 deg 12 min N, 108 deg 45 min E (Within Indonesian Sovereignty)',
            'Observation: The vessel was deploying pair trawl nets without a valid fishing permit (SIPI).'
        ]),
        ('2. Participant Instructions & Tasks', [
            'Task 1: Draft an English Radio Warning Transmission (Standard Marine Communication Phrase).',
            'Task 2: Compose a 250-word Diplomatic Summary to be submitted to the Ministry of Foreign Affairs.',
            'Task 3: Identify the relevant UNCLOS 1982 articles governing sovereign rights over marine resources.'
        ]),
        ('3. Grading Rubric (Total: 100 Points)', [
            'Accuracy of Marine Terminology (IMO SMCP): 30 Points',
            'Diplomatic Tone and Formal Protocol: 30 Points',
            'Grammar, Clarity, and Sentence Structure: 20 Points',
            'Legal Grounding & Regulatory Citation (UNCLOS): 20 Points'
        ])
    ]
)

print('All 4 PDF documents generated successfully!')

