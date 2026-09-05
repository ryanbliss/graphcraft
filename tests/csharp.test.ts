import { expect, it } from "vitest";
import { analyzeProject } from "../src/graph/analyze.ts";

const analyze = (files: Record<string, string>) =>
  analyzeProject(
    Object.entries(files).map(([path, content]) => ({ path, content })),
    "mixed",
  );
const sdk = '<Project Sdk="Microsoft.NET.Sdk" />';
it("combines TS imports, explicit dotnet project and NuGet references, and unique C# types with static artifacts", () => {
  const graph = analyze({
    "package.json": '{"name":"mixed"}',
    "src/index.ts":
      'import settings from "../data/settings.json"; import { value } from "./value"; export { value, settings };',
    "src/value.ts": "export const value = 1;",
    "data/settings.json": '{"theme":"amber"}',
    "README.md": "# Architecture",
    "App/App.csproj":
      '<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><ProjectReference Include="../Domain/Domain.csproj"/><PackageReference Include="Newtonsoft.Json" Version="13.0.3"/></ItemGroup></Project>',
    "App/Runner.cs":
      "using Sample.Domain; namespace Sample.App; public class Runner { public Widget Run() { return new Widget(); } }",
    "Domain/Domain.csproj": sdk,
    "Domain/Widget.cs": "namespace Sample.Domain { public class Widget {} }",
    "Unrelated/Other.csproj": sdk,
    "Unrelated/Widget.cs": "namespace Sample.Domain; public class Widget {}",
    "Workspace.sln":
      'Project("guid") = "App", "App\\App.csproj", "id"\nEndProject',
  });
  expect(
    graph.nodes.find((node) => node.id === "App/Runner.cs")?.packageId,
  ).toBe("dotnet:App/App.csproj");
  expect(
    graph.nodes.find((node) => node.id === "Domain/Widget.cs")?.exports,
  ).toEqual(["Sample.Domain.Widget"]);
  expect(graph.edges).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: "src/index.ts",
        target: "data/settings.json",
        kind: "import",
      }),
      expect.objectContaining({
        source: "src/index.ts",
        target: "src/value.ts",
        kind: "import",
      }),
      expect.objectContaining({
        source: "App/App.csproj",
        target: "Domain/Domain.csproj",
        kind: "import",
      }),
      expect.objectContaining({
        source: "App/App.csproj",
        target: "nuget:Newtonsoft.Json",
        kind: "import",
      }),
      expect.objectContaining({
        source: "App/Runner.cs",
        target: "Domain/Widget.cs",
        kind: "type",
      }),
      expect.objectContaining({
        source: "Workspace.sln",
        target: "App/App.csproj",
        kind: "import",
      }),
    ]),
  );
  expect(
    graph.edges.some(
      (edge) =>
        edge.source === "App/Runner.cs" &&
        edge.target === "Unrelated/Widget.cs",
    ),
  ).toBe(false);
  expect(
    graph.edges.filter((edge) =>
      ["data/settings.json", "README.md"].includes(edge.source),
    ),
  ).toEqual([]);
  expect(graph.diagnostics).toHaveLength(1);
});
it("keeps ambiguous, conditional and unprojected C# static without fabricated edges", () => {
  const graph = analyze({
    "App/App.csproj":
      '<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><ProjectReference Include="../A/A.csproj"/><ProjectReference Include="../B/B.csproj"/><ProjectReference Include="../Missing.csproj" Condition="false"/></ItemGroup></Project>',
    "App/Runner.cs":
      'using Shared; public class Runner { object Run() => new Widget(); string Example = "new Pretend()"; /* new Imaginary() */ }',
    "App/Conditional.cs":
      "#if SOMETHING\nusing Shared; public class Conditional { object Run() => new Widget(); }\n#endif",
    "A/A.csproj": sdk,
    "A/Widget.cs": "namespace Shared; public class Widget {}",
    "B/B.csproj": sdk,
    "B/Widget.cs": "namespace Shared; public class Widget {}",
    "Loose/Widget.cs": "namespace Loose; public class Widget {}",
    "Loose/Use.cs":
      "namespace Loose; public class Use { Widget value = new Widget(); }",
  });
  expect(graph.edges.filter((edge) => edge.source.endsWith(".cs"))).toEqual([]);
  expect(graph.nodes.some((node) => node.id === "Loose/Use.cs")).toBe(true);
  expect(graph.diagnostics).toHaveLength(1);
  expect(graph.diagnostics[0].message).toContain("remain static");
});
it("honors ordered Compile removals/includes for sibling projects, aliases and global using scopes", () => {
  const graph = analyze({
    "Lib/Lib.csproj":
      '<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><Compile Remove="Tests/**/*.cs"/></ItemGroup></Project>',
    "Lib/Lib.Tests.csproj":
      '<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><Compile Remove="**/*.cs"/><Compile Include="Tests/**/*.cs"/><ProjectReference Include="Lib.csproj"/></ItemGroup></Project>',
    "Lib/Widget.cs": "namespace Shared; public record Widget;",
    "Lib/Tests/Globals.cs": "global using W = Shared.Widget;",
    "Lib/Tests/Runner.cs":
      'public class Runner { W Build() { var empty = ""; return new W(); } }',
  });
  expect(
    graph.nodes.find((node) => node.id === "Lib/Widget.cs")?.packageId,
  ).toBe("dotnet:Lib/Lib.csproj");
  expect(
    graph.nodes.find((node) => node.id === "Lib/Tests/Runner.cs")?.packageId,
  ).toBe("dotnet:Lib/Lib.Tests.csproj");
  expect(graph.edges).toContainEqual(
    expect.objectContaining({
      source: "Lib/Tests/Runner.cs",
      target: "Lib/Widget.cs",
      kind: "type",
    }),
  );
});
it("keeps unknown authored text as artifacts and rejects binary or credential content", () => {
  const graph = analyze({
    "main.py": "print('hello')",
    "script.custom": "an authored DSL",
    "design.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
    "opaque.blob": "binary\0payload",
    "private.txt": "-----BEGIN PRIVATE KEY-----\nsecret",
    "data.json": '{"imports":["pretend"]}',
  });
  expect(graph.nodes.map((node) => node.id)).toEqual([
    "data.json",
    "design.svg",
    "main.py",
    "script.custom",
  ]);
  expect(graph.edges).toEqual([]);
});
