import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'WireGuard is a VPN built on public keys. Every peer has an X25519 private key and the matching public key, and a tunnel works when each side lists the other peer public key with the addresses it may use.',
        'This tool writes a wg0.conf for the server and one clientN.conf per client. It creates every key with Web Crypto in your browser or editor, clamps each private key the way wg genkey does, and derives public keys from them.',
        'Each client gets its own address from the subnet, and an optional preshared key adds a symmetric layer on top of the key exchange. The files are ready for wg-quick.',
      ],
      title: 'How a WireGuard setup is built',
    },
    {
      content: [
        'Set up a small VPN server with a few client files in one step.',
        'Create a split tunnel that routes only your own subnets through the VPN.',
        'Add IPv6 and NAT rules to a server that forwards traffic to the internet.',
        'Generate a key pair, or derive a public key from a private key, like wg pubkey.',
      ],
      title: 'When to use WireGuard Config Generator',
    },
  ],
  examples: [
    'Endpoint vpn.example.com with 3 clients and the default subnet → wg0.conf plus client1.conf to client3.conf, full tunnel.',
    'VPN subnet only → clients route 10.8.0.0/24 through the tunnel and everything else stays local.',
    'IPv6 subnet fd00:8::/64 with NAT interface eth0 → dual stack addresses and iptables plus ip6tables rules.',
    'Custom AllowedIPs 192.168.1.0/24 and 10.20.0.0/16 → clients reach only those networks.',
    'Private key dwdtCnMYpX08FsFyUbJmRd9ML4frwJkqsXf7pR25LCo= → public key hSDwCYkwp1R0i33ctD73Wg2/Og0mOBr066SpjqqbTmo=.',
    'Preshared keys off → peers carry only the public keys.',
  ],
  faq: [
    {
      answer:
        'Copy the files to the machines, or turn a client file into a QR code with the QR Code Generator for a phone. Then run wg-quick up wg0 on the server and on each client.',
      question: 'How do I use the generated files?',
    },
    {
      answer:
        'Nothing is uploaded or stored. The keys come from the Web Crypto random generator and appear only in the result. Treat the output as secret, because it holds private keys.',
      question: 'Are the generated keys sent anywhere?',
    },
    {
      answer:
        'The server needs net.ipv4.ip_forward=1 in sysctl to route client traffic. The NAT interface names the network card that reaches the internet, such as eth0, and enables the masquerade rules.',
      question: 'What does the NAT interface do?',
    },
    {
      answer:
        'The runtime lacks X25519 in Web Crypto. Use a current Chrome, Edge, Safari or Firefox, or update VS Code, because this tool has no own Curve25519 fallback.',
      question: 'Why does it say the runtime does not support X25519?',
    },
    {
      answer:
        'A private key is first clamped the way wg genkey does, so the public key matches the output of wg pubkey. The PrivateKey line keeps the key exactly as you entered it.',
      question: 'Does a pasted private key give the same public key as wg pubkey?',
    },
  ],
  help: 'Choose Server and clients or Key pair. In server mode enter the Endpoint, a DNS name, an IPv4 address or an IPv6 address without a port, and the Listen port from 1 to 65,535. The IPv4 subnet must be a network address with a prefix from /8 to /30 that has room for the server and every client; add an IPv6 prefix from /48 to /120 for dual stack.\n\nSet the number of Clients from 1 to 50, then choose what clients route. Full tunnel sends all IPv4 traffic, and all IPv6 traffic only when you add an IPv6 prefix; without one, IPv6 traffic stays outside the tunnel. VPN subnet only sends the subnets, and Custom takes up to 64 CIDRs, one per line. Add up to 4 DNS servers, a PersistentKeepalive from 0 to 65,535 seconds where 0 leaves it out, and switch preshared keys on or off.\n\nGive a NAT interface to add PostUp and PostDown rules to the server. In key pair mode leave the private key empty to generate a pair, or paste a private key to derive its public key.\n\nThe result lists every file after a header line, and each file can be saved on its own. wg0.conf comes first, followed by client1.conf and the rest. The summary shows the server address, the client count, the tunnel type and whether preshared keys are used.',
  notes: [
    'Processing is local; nothing is uploaded or stored.',
    'The output holds private keys. Keep it secret and do not paste it into tickets or chats.',
    'Limits: 1 to 50 clients, 64 custom AllowedIPs entries and 4 DNS servers.',
    'Enable net.ipv4.ip_forward=1 on the server for NAT and routing between peers and the internet.',
    'Every value must be one line; IPv6 zones such as %eth0 are rejected.',
    'The interface is always named wg0. Third-party servers and client-only configs are not supported.',
  ],
};
