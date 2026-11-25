import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'WiFi QR Code builds the standard WIFI: text that phone cameras understand, such as WIFI:T:WPA;S:Home-WiFi;P:secret;H:false;;, and draws it as a scannable SVG QR code.',
        'Scanning the code offers to join the network without typing the password.',
      ],
      title: 'What is WiFi QR Code?',
    },
    {
      content: [
        'Print a code for guests at home, in an office, a café or a holiday rental, or add one to an event badge or welcome sheet.',
        'Share a long or complex password without reading it out loud.',
      ],
      title: 'When to use WiFi QR Code',
    },
  ],
  examples: [
    'SSID Home-WiFi, Password secret-passphrase-123, WPA/WPA2 → WIFI:T:WPA;S:Home-WiFi;P:secret-passphrase-123;H:false;;',
    'SSID CoffeeShop-Guest, Security None → WIFI:T:nopass;S:CoffeeShop-Guest;P:;H:false;;',
    'Hidden network ticked → the text ends in H:true;; so phones search for the network by name.',
    'SSID My Cafe; Lounge → S:My Cafe\\; Lounge, because the semicolon is escaped.',
    'Password latte:mocha;secure! → P:latte\\:mocha\\;secure!',
    'WPA/WPA2 with an empty Password → error: WiFi password input is required.',
    'Any network → wifi-qr.svg, a 256 px QR code with a 4-module quiet zone.',
  ],
  faq: [
    {
      answer:
        'One line in the WIFI: format, such as WIFI:T:WPA;S:Home-WiFi;P:secret;H:false;; where T is the security type, S the network name, P the password and H whether the network is hidden. The tool shows this text so you can check it.',
      question: 'What text is inside a WiFi QR code?',
    },
    {
      answer:
        'Yes. The built-in camera apps of current iPhones and Android phones recognize WIFI: codes and offer to join the network. Older phones may need a QR scanner app.',
      question: 'Can iPhones and Android phones join by scanning it?',
    },
    {
      answer:
        'Semicolons, colons, commas, quotes and backslashes separate the fields of the WIFI: format, so they are escaped with a backslash when they appear in the name or password. Phones remove the backslashes when they join.',
      question: 'Why are there backslashes in the WiFi QR text?',
    },
    {
      answer:
        'Pick WPA/WPA2 for almost every router, including WPA2-Personal networks, WEP only for very old equipment, and None for open guest networks. The option must match the router setting, or the phone fails to connect.',
      question: 'Which Security option should I choose?',
    },
    {
      answer:
        'Not in this tool, which always draws a 256 px black-on-white SVG. Copy the WIFI: text into QR Code Generator to choose size, colors, margin and error correction.',
      question: 'Can I make the WiFi QR code bigger or change its colors?',
    },
    {
      answer:
        'No. The WIFI: text and the SVG are built on your device without network requests, and the Password field is masked while you type.',
      question: 'Is my WiFi password uploaded?',
    },
  ],
  help: 'Type the network name in SSID exactly as your devices show it, including capital letters.\n\nChoose Security: WPA/WPA2 for most home and office routers, WEP for very old ones, or None for an open network.\n\nEnter the Password, and tick Hidden network if the router does not broadcast its name.\n\nRun the tool, copy the WIFI: text or download wifi-qr.svg, and test the code with a phone before printing it.',
  notes: [
    'The WIFI: text and the QR code are generated on your device; the network name and password are not sent anywhere.',
    'Backslash, semicolon, comma, colon and double quote are escaped with a backslash, as the WIFI: format requires.',
    'Spaces at the start or end of SSID and Password are removed, so a name or password that begins or ends with a space will not match.',
    'The code always uses Medium error correction, 256 px and a 4-module margin.',
    'Security None leaves P: empty and ignores the Password field; WPA/WPA2 and WEP require a password.',
  ],
};
