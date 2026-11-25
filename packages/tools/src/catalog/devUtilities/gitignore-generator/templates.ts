type GitignoreTemplate = {
  id: string;
  label: string;
  rules: string[];
};

type GitignoreTemplateGroup = {
  id: string;
  label: string;
  templates: GitignoreTemplate[];
};

export const gitignoreTemplateGroups: GitignoreTemplateGroup[] = [
  {
    id: 'languages',
    label: 'Languages',
    templates: [
      {
        id: 'node',
        label: 'Node.js',
        rules: [
          'node_modules/',
          'npm-debug.log*',
          'yarn-debug.log*',
          'yarn-error.log*',
          'pnpm-debug.log*',
          '.env',
          '.env*.local',
        ],
      },
      {
        id: 'python',
        label: 'Python',
        rules: [
          '__pycache__/',
          '*.py[cod]',
          '*$py.class',
          '.Python',
          'build/',
          'dist/',
          '*.egg-info/',
          '.venv/',
          'venv/',
          'env/',
          '.pytest_cache/',
          '.mypy_cache/',
          '.coverage',
          'htmlcov/',
        ],
      },
      {
        id: 'java',
        label: 'Java',
        rules: ['*.class', '*.jar', '*.war', '*.ear', 'target/', '.gradle/', 'build/', 'out/'],
      },
      {
        id: 'dotnet',
        label: '.NET',
        rules: ['[Bb]in/', '[Oo]bj/', '*.user', '*.suo', '*.userosscache', '*.sln.docstates'],
      },
      { id: 'go', label: 'Go', rules: ['bin/', '*.test', '*.out', 'vendor/'] },
      { id: 'rust', label: 'Rust', rules: ['target/'] },
      {
        id: 'ruby',
        label: 'Ruby',
        rules: [
          '/.bundle/',
          '/vendor/bundle',
          '/log/*',
          '/tmp/*',
          '.byebug_history',
          '.ruby-version',
        ],
      },
      {
        id: 'php',
        label: 'PHP',
        rules: ['/vendor/', '.phpunit.result.cache', '.php-cs-fixer.cache'],
      },
    ],
  },
  {
    id: 'frameworks',
    label: 'Frameworks',
    templates: [
      { id: 'react-vite', label: 'React / Vite', rules: ['dist/', '.vite/', '*.local'] },
      { id: 'nextjs', label: 'Next.js', rules: ['.next/', 'out/', '.vercel/'] },
      { id: 'nuxt', label: 'Nuxt', rules: ['.nuxt/', '.output/', '.data/'] },
      { id: 'angular', label: 'Angular', rules: ['.angular/cache/', 'dist/'] },
      { id: 'sveltekit', label: 'SvelteKit', rules: ['.svelte-kit/', 'build/'] },
      { id: 'astro', label: 'Astro', rules: ['.astro/', 'dist/'] },
      {
        id: 'django',
        label: 'Django',
        rules: ['*.log', 'local_settings.py', 'db.sqlite3', 'media/'],
      },
      {
        id: 'rails',
        label: 'Rails',
        rules: ['.bundle/', '/log/*', '/tmp/*', '/storage/*', '/public/assets', '/public/packs'],
      },
      {
        id: 'laravel',
        label: 'Laravel',
        rules: ['/vendor/', '.env', '.env.backup', '.phpunit.result.cache', 'storage/*.key'],
      },
    ],
  },
  {
    id: 'os',
    label: 'Operating systems',
    templates: [
      {
        id: 'macos',
        label: 'macOS',
        rules: ['.DS_Store', '.AppleDouble', '.LSOverride', '._*', '.Spotlight-V100', '.Trashes'],
      },
      {
        id: 'windows',
        label: 'Windows',
        rules: ['Thumbs.db', 'ehthumbs.db', 'Desktop.ini', '$RECYCLE.BIN/'],
      },
      { id: 'linux', label: 'Linux', rules: ['*~', '.fuse_hidden*', '.directory', '.Trash-*'] },
    ],
  },
  {
    id: 'editors',
    label: 'Editors',
    templates: [
      {
        id: 'vscode',
        label: 'VS Code',
        rules: [
          '.vscode/*',
          '!.vscode/extensions.json',
          '!.vscode/tasks.json',
          '!.vscode/launch.json',
          '!.vscode/settings.json',
        ],
      },
      { id: 'jetbrains', label: 'JetBrains', rules: ['.idea/', '*.iws', '*.iml', '*.ipr'] },
      {
        id: 'visual-studio',
        label: 'Visual Studio',
        rules: ['.vs/', '*.sln.iml', '*.user', '*.rsuser'],
      },
      { id: 'vim', label: 'Vim', rules: ['*.swp', '*.swo', '*.swn', '*~'] },
    ],
  },
  {
    id: 'devops',
    label: 'DevOps',
    templates: [
      { id: 'docker', label: 'Docker', rules: ['docker-compose.override.yml'] },
      {
        id: 'terraform',
        label: 'Terraform',
        rules: [
          '.terraform/',
          '*.tfstate',
          '*.tfstate.*',
          'crash.log',
          'crash.*.log',
          '*.tfvars',
          '*.tfvars.json',
          'override.tf',
          'override.tf.json',
          '*_override.tf',
          '*_override.tf.json',
          '.terraformrc',
          'terraform.rc',
        ],
      },
      {
        id: 'kubernetes',
        label: 'Kubernetes',
        rules: ['kubeconfig', '*.kubeconfig', 'secrets.yaml', 'secrets.yml'],
      },
      { id: 'serverless', label: 'Serverless Framework', rules: ['.serverless/', '.webpack/'] },
      { id: 'aws-sam', label: 'AWS SAM', rules: ['.aws-sam/'] },
      { id: 'pulumi', label: 'Pulumi', rules: ['.pulumi/'] },
    ],
  },
];
