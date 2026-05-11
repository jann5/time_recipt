const fs = require('fs');
const path = require('path');

const MAPPING = {
  'onboarding_krok_1_nowa_sp_jno/code.html': 'Onboarding1',
  'onboarding_krok_2_poprawiona_sp_jno/code.html': 'Onboarding2',
  'onboarding_krok_3_nowa_sp_jno/code.html': 'Onboarding3',
  'onboarding_krok_4_finalna_sp_jno/code.html': 'Onboarding4',
  'tw_j_paragon_dnia/code.html': 'DailyReceipt',
  'poprawiony_rachunek_tygodniowy/code.html': 'WeeklyReceipt',
  'ustawienia_rozprosze_sp_jne/code.html': 'Settings'
};

const dlPath = '/Users/jannawrot/Downloads/stitch_distraction_receipt/';
const screensPath = '/Users/jannawrot/PROJEKTY_WEB/time_recipt/distraction-receipt/src/screens/';

function convertHtmlToReact(html, componentName) {
  // Extract content between <div class="relative z-10... and </body>
  let match = html.match(/<!-- Main Content Container[^-]*-->\s*([\s\S]*?)<\/body>/);
  if (!match) {
    match = html.match(/<body[^>]*>\s*(?:<!--[^>]*>\s*|<div class="absolute[^>]*><\/div>\s*)*(<div class="relative z-10[\s\S]*?)<\/body>/);
  }
  let body = match ? match[1] : html;
  body = body.trim();
  
  // Convert class -> className
  body = body.replace(/class=/g, 'className=');
  // Convert style strings to objects for simple ones, or just remove if complex
  body = body.replace(/style="font-variation-settings: 'wght' 200;"/g, "style={{ fontVariationSettings: \"'wght' 200\" }}");
  body = body.replace(/style="width: ([\d.]+)%;"/g, "style={{ width: '$1%' }}");
  // Close standalone tags
  body = body.replace(/(<img[^>]*[^\/])>/g, '$1 />');
  body = body.replace(/(<input[^>]*[^\/])>/g, '$1 />');
  body = body.replace(/(<hr[^>]*[^\/])>/g, '$1 />');
  
  // Custom props for different components based on expected old props
  let props = '';
  if (componentName.startsWith('Onboarding')) {
      props = '{ onNext }: { onNext: () => void }';
      if (body.includes('Dalej')) {
          body = body.replace(/<button([^>]*)>(.*?)<\/button>/is, '<button$1 onClick={onNext}>$2</button>');
      }
      if (body.includes('ZACZYNAMY')) {
          body = body.replace(/<button([^>]*)>(.*?)<\/button>/is, '<button$1 onClick={onNext}>$2</button>');
      }
  } else if (componentName === 'Settings') {
      props = '{ onClose }: { onClose: () => void }';
  } else {
      props = ''; // Modify as needed
  }
  
  // Fix multiple root elements
  const jsx = `import React from 'react';\n\nexport default function ${componentName}(${props}) {\n  return (\n    <>\n${body}\n    </>\n  );\n}\n`;
  return jsx;
}

for (const [relPath, comp] of Object.entries(MAPPING)) {
  const fullHtmlPath = path.join(dlPath, relPath);
  if (!fs.existsSync(fullHtmlPath)) {
    console.warn('Missing ' + fullHtmlPath);
    continue;
  }
  const html = fs.readFileSync(fullHtmlPath, 'utf8');
  let jsx = convertHtmlToReact(html, comp);
  const targetPath = path.join(screensPath, `${comp}.tsx`);
  fs.writeFileSync(targetPath, jsx, 'utf8');
  console.log(`Updated ${comp}.tsx`);
}
