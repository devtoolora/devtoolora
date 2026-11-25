import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Docker Run to Compose translates one literal docker run or docker container run command into a Compose file with an app service. Image options stop at the image; subsequent arguments become an explicit command list.',
        'Compose describes persistent services, not every lifecycle behavior of a one-off run. Detached mode and --rm are explained as invocation choices rather than invented service properties.',
        'The converter is static. It does not run a shell, Docker or containers, fetch an image, read an env file, resolve a host variable or inspect a volume/network. Unknown options fail instead of disappearing.',
      ],
      title: 'What is Docker Run to Compose?',
    },
    {
      content: [
        'Move a single local container command into a reviewable compose.yaml.',
        'Preserve quoted environment values, mount paths and executable arguments while replacing ad-hoc launch syntax.',
        'Review named-volume identity, existing networks, exposed host data and unresolved environment variables before deployment.',
        'Export YAML plus a JSON audit for a code review. Check the final file against the Docker Compose version and environment you actually use.',
      ],
      title: 'When to convert Docker Run to Compose',
    },
  ],
  examples: [
    'docker run -d --name web -p 8080:80 nginx:alpine → services.app with container_name: "web", ports: ["8080:80"] and image: "nginx:alpine", plus a warning that -d belongs to docker compose up -d.',
    'docker run -v pgdata:/var/lib/postgresql/data postgres:16 → a volume mount and a top-level volumes.pgdata with name: "pgdata", so no Compose project prefix is added.',
    'docker run --mount type=bind,source=/srv/site,target=/usr/share/nginx/html,readonly nginx:alpine → a bind mount with read_only: true and create_host_path: false.',
    'docker run alpine sh -c \'echo "$HOME"\' → command: ["sh", "-c", "echo \\"$$HOME\\""], doubled so Compose does not interpolate it.',
    'docker run -e API_TOKEN alpine → environment: ["API_TOKEN"] with a warning that the value is unresolved.',
    'docker run --gpus all image → error: Unsupported Docker option: --gpus. Nothing is silently omitted.',
  ],
  faq: [
    {
      answer:
        'No. The command is only parsed as text: no shell, Docker daemon or container is started, no image is pulled, and no env file, volume or network is inspected.',
      question: 'Does this tool run my docker command?',
    },
    {
      answer:
        'They describe how a container is started, not the service. Use docker compose up -d for detached mode and docker compose run --rm app for a one-off container; the tool adds a warning for each instead of inventing a property.',
      question: 'Why are -d and --rm not in the Compose file?',
    },
    {
      answer:
        'Compose replaces $VAR with values from its own environment. Doubling the dollar sign passes a literal $HOME to the container, as the single-quoted docker run argument did. An unquoted $HOME is rejected, because host-shell expansion is not evaluated.',
      question: 'Why does $HOME become $$HOME in the YAML?',
    },
    {
      answer:
        'The conversion stops with an error naming the option, such as --gpus, instead of dropping it silently. Remove the option, convert, then add the matching Compose setting by hand.',
      question: 'What happens with a docker run option the converter does not support?',
    },
    {
      answer:
        'Not in one go. Each conversion takes one docker run or docker container run command and produces one app service; shell operators such as && or ; are rejected. Convert each command and merge the services by hand.',
      question: 'Can I convert several docker run commands into one compose file?',
    },
    {
      answer:
        'docker run --network app-net joins a network that already exists, so the Compose file declares it with external: true and name: "app-net" instead of creating a new project network. Create it first with docker network create app-net.',
      question: 'Why is my network marked external?',
    },
  ],
  help: 'Paste one literal command, or choose a sample. POSIX-style single/double quotes, adjacent quoted segments, escaped characters and backslash-newline continuation are supported.\n\nRead the generated app service and conversion warnings. After the image, all tokens are command arguments, even when they look like Docker options.\n\nSwitch to JSON audit to inspect decoded command arguments, raw Compose values and warnings. YAML doubles literal dollar signs so Compose does not substitute them; audit values retain the original decoded dollars.\n\nDownload compose.yaml or docker-compose-report.json. Both exports are from the same conversion. Review with docker compose config in your own environment; configuration inspection can reveal or resolve secrets.',
  notes: [
    'Supports --name, --hostname/-h, --publish/-p, --env/-e, --env-file, --volume/-v, --mount, --restart, --entrypoint, --workdir/-w, --user/-u, --label/-l, --platform, --network/--net, --dns, --expose, --add-host, --cap-add/--cap-drop, --security-opt, --tmpfs, --memory/-m and --cpus.',
    'Supports -d/-i/-t and clusters such as -dit or -dp 80:80, plus long boolean --detach, --interactive, --tty, --rm, --init, --read-only and --privileged (long booleans accept =true|false). Value flags accept separate values, --flag=value or attached short values such as -p8080:80.',
    'Unknown flags, global Docker options, sudo wrappers, PowerShell/cmd quoting, unquoted globbing/tilde, comments, shell operators and host-shell expansion are rejected. Single-quote or backslash-escape literal dollars; no host environment is read.',
    'Short mounts support anonymous volumes, named volumes and absolute/./../ POSIX or single-quoted Windows bind paths, with ro/rw and bind z/Z flags. --mount supports bind/volume, source/src, target/dst/destination, readonly/ro and volume-nocopy. Other mount sub-options or embedded CSV commas require manual conversion.',
    'Short bind mounts allow host-path creation, matching -v behavior. --mount bind disallows it. Relative paths change their base to the Compose file directory; verify them manually.',
    'Named volumes are declared with an explicit name to retain engine identity. A named network is declared external and must already exist. No data is copied, created, removed or inspected.',
    'Command and entrypoint use lists so quoting boundaries are preserved. An empty --entrypoint becomes an empty list. Repeated scalar flags use the last value with a warning; list flags preserve input order.',
    'Literal dollar signs are doubled only in YAML, including command, label and environment values, to avoid Compose interpolation. JSON audit contains raw decoded values and the exported YAML; it also contains the original input.',
    'Input and audits may contain passwords, tokens, host paths or other private data. Exports are not redacted. Bare --env NAME and referenced env files are unresolved; no file contents or environment values are obtained.',
    'Basic flag/value syntax is validated, but this is not Docker Engine or Compose schema/runtime validation. Image existence, host files, secrets, network availability and platform support remain unverified.',
    'Input is bounded to 100,000 UTF-16 units and 2,048 arguments. Errors produce no partial YAML or old export. No Docker process or shell command is executed.',
  ],
};
