import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A Compose file describes the services, networks and volumes of a multi-container app. Docker Compose reads it with a strict schema, so a misspelled key, a port written as 80:80:80 or a depends_on that names a missing service stops docker compose up before any container starts.',
        'This tool parses the YAML and checks it against a built-in table of the Compose Specification keys. It reports unknown keys with a suggestion, including inside deploy, logging, ulimits and develop, values of the wrong shape, numbers and sizes that cannot be read, invalid port and volume mappings, references to services, volumes, networks, secrets, configs and models that are not defined, and dependency cycles, including those through links, volumes_from and service: namespaces.',
        'The check is static and runs entirely in your browser. It does not start Docker, resolve variables, read .env files or pull images, and it covers the common rules rather than the full specification. A clean report means none of these checks found a problem. Invalid means Docker Compose refuses the file. A value it accepts but that may fail when the stack starts is a warning. A clean report does not prove that Docker Compose accepts the file or that the stack will run, so run docker compose config for the final word.',
      ],
      title: 'What does a Compose file validator check?',
    },
    {
      content: [
        'Find a typo such as enviroment or replica under deploy, or a restart value written without quotes, before running the stack.',
        'Check a file you copied from a blog post or an older project against the current specification.',
        'Catch a missing volume or network declaration that only fails at deploy time.',
        'Review a pull request that changes docker-compose.yml, including warnings about obsolete keys and duplicate host ports.',
      ],
      title: 'When to use Docker Compose Validator',
    },
  ],
  examples: [
    'enviroment: [DEBUG=1] → services.web.enviroment: unknown key; did you mean "environment"?',
    'ports: ["80:80:80"] → "80:80:80" is not a valid port mapping.',
    'restart: false → restart: write "no" in quotes. restart: foo → a warning, because Docker Compose accepts it and only the engine refuses it.',
    'depends_on: [cache] with no cache service → depends on undefined service "cache".',
    'web depends on api and api depends on web → Dependency cycle: web → api → web.',
    'image: ${REGISTRY}/web → skipped and counted as an interpolated value that was not checked.',
  ],
  faq: [
    {
      answer:
        'Compose v2 ignores the top-level version key, so the file still works. The tool lists it as a warning, not an error, because removing it is cleanup rather than a fix.',
      question: 'Why is version a warning?',
    },
    {
      answer:
        'Some values get past docker compose config and may only fail when the stack starts, such as restart: foo, an unknown volume mode or port mode, a relative volume target, an environment entry with no name, or healthcheck test: []. The tool lists those as warnings and still says Valid, because Invalid means Docker Compose refuses the file.',
      question: 'Why does a valid file have warnings about values that look wrong?',
    },
    {
      answer:
        'A value with ${VAR} or $VAR is replaced by Compose at run time, so its final shape is unknown. The tool skips the check for that value and counts it in the summary.',
      question: 'Why are some values not checked?',
    },
    {
      answer:
        'Keys starting with x- are extension fields that Compose ignores. They are accepted anywhere the specification allows them, and they work well with YAML anchors and merge keys.',
      question: 'Are x- keys allowed?',
    },
    {
      answer:
        'No. The check covers the common rules of the Compose Specification, not all of them, and not your Docker version. A file can pass here and still be refused by docker compose config, for example through a variable that resolves to a bad value or a key that an older Docker Compose does not know.',
      question: 'Does a clean report guarantee that docker compose up works?',
    },
    {
      answer:
        'Compose files often hold passwords and tokens, so the input is not saved in drafts. Everything is processed locally and nothing is uploaded.',
      question: 'Is my Compose file sent anywhere?',
    },
  ],
  help: 'Paste a Compose file, such as compose.yaml or docker-compose.yml. The tool reads one YAML document with merge keys and anchors, and the top level must be a mapping.\n\nThe report lists each issue as the severity and the path to the value, with the message on the next line. Errors come first, then warnings. A valid file with no issues shows No issues found. The summary counts services, networks, volumes, warnings and values skipped because of interpolation.\n\nChoose JSON to get errors, warnings, the service count and a valid flag as structured data, for example in a CI check. The other format is always available as a second download.\n\nNot checked: include files, extends targets in other files, image names, port conflicts with the host, and whether deploy settings make sense together.',
  notes: [
    'Processing is local; nothing is uploaded and the input is not saved in drafts.',
    'Limits: 1,000,000 characters, 1,000 services and 500 listed issues; the JSON output keeps every issue.',
    'The key table follows the Compose Specification used by Docker Compose v2.',
    'Identical and overlapping host port ranges are reported as warnings. Compose itself accepts them; the conflict appears when the stack starts.',
    'Variables are never resolved and .env files are not read.',
    'Not looked into: include, jobs, the top-level models section, gpus, devices, label_file, lifecycle hooks, generic_resources and placement preferences.',
    'Quoted booleans such as "true" are accepted, and old forms such as yes and off get a warning, as in Docker Compose.',
  ],
};
