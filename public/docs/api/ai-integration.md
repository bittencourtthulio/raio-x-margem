# Integração com agentes

Versão 1.0.0

O contrato 1.0.0 está em /docs/api/v1/openapi.json e /openapi.json; a descoberta está em /llms.txt, com aliases /LLM.txt e /llm.txt. Leia Markdown sem interface visual. llms.txt não concede acesso nem autorização de escrita.

A skill de prévia está em /downloads/raio-x-margem-api-skill.zip, com SHA-256 e tamanho em /downloads/raio-x-margem-api-skill.json. Ela contém SKILL.md, referências e contrato. Pacote publicado pelo titular junto ao código-fonte. Nenhuma licença adicional de reutilização é concedida.

Instale a pasta inteira raio-x-margem-api, preservando referências. Codex: .agents/skills; Claude Code: .claude/skills; OpenCode: .opencode/skills. Instalação global: Codex ~/.agents/skills; Claude Code ~/.claude/skills; OpenCode ~/.config/opencode/skills. Acrescente raio-x-margem-api a cada caminho. A instalação não executa chamadas. Em cloud, adicione a pasta ao contexto do projeto remoto; pastas globais locais não são transferidas automaticamente. O ZIP, frontmatter, referências e exemplos foram validados estruturalmente. Os conectores TypeScript e Python foram executados no sandbox local. A skill ainda não foi executada em sessões isoladas de Codex, Claude Code ou OpenCode, nem em cloud; essa validação de portabilidade permanece pendente.

Fontes de instalação: [Codex](https://learn.chatgpt.com/docs/build-skills), [Claude Code](https://code.claude.com/docs/en/skills), [OpenCode](https://opencode.ai/docs/skills/).
