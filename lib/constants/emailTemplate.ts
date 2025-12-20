/**
 * Default email template - used as fallback when database template is not available
 * This is a single source of truth for the default template
 * Personal information is replaced with placeholders to avoid sharing with AI
 */
export const DEFAULT_EMAIL_SUBJECT = "Request for Admission Acceptance Letter for Master's Program";

export const DEFAULT_EMAIL_TEMPLATE = `Dear Professor [PROFESSOR_NAME],

I hope this email finds you well. I'm [YOUR_NAME], and currently completing my [YOUR_DEGREE] at [YOUR_UNIVERSITY], with a current GPA of [YOUR_GPA]. I am writing to express my strong interest in pursuing a Master's degree under your supervision and to inquire whether you are accepting graduate students in the upcoming intake.

My academic interests lie in semiconductor devices, TCAD simulation, and integrated circuit design, with a particular focus on wide-bandgap materials such as SiC and GaN. During my undergraduate studies, I completed a TCAD project on the I-V and breakdown characteristics of a SiC Enhancement Mode IEMOSFET, for which I received an A+ grade. I have also co-authored an IEEE conference paper on satellite network design and completed an Integrated Circuit CAD Design internship, where I gained hands-on experience with DRC/LVS verification and parasitic analysis. In next semester, I will do my thesis on Negative thermal expansion properties of dual-cation substituted (KNi)xSc2-x(WO4)3 under supervision of Prof. Liu Hong Fei , College in-charge of Physical science and technology. 

In addition to academics, I have led innovation-driven projects, including a Direct Air Capture (DAC) CO₂ utilization system for sustainable agriculture, which won the Best Innovation Award (2024). These experiences have strengthened my research mindset, problem-solving ability, and sense of responsibility as an engineer.

I am particularly interested in your research on Low Power and Ultra-low Power Integrated Circuits Design, especially your work on adaptive voltage/frequency scaling and energy-efficient architectures, as it aligns closely with my academic background and my goal of advancing my expertise. I would be deeply honored to learn under your guidance and contribute meaningfully to your research group.

I have attached my CV and transcript for your reference. I would greatly appreciate the opportunity to discuss potential research directions or application procedures for your group.

Thank you very much for your time and consideration. I look forward to the possibility of hearing from you.

Kind regards,
[YOUR_NAME]
[YOUR_DEGREE]
[YOUR_UNIVERSITY]
Email: [YOUR_EMAIL]`;

