import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { curlToFetch } from '../src/web';
import { renderCurlAsCode } from '../src/web/codeRenderers';

const post =
  "curl -X POST 'https://api.example.com/items' -H 'Content-Type: application/json' --data-raw '{\"name\":\"Ada\"}'";
const go = [
  'package main',
  '',
  'import (',
  '\t"fmt"',
  '\t"io"',
  '\t"net/http"',
  '\t"strings"',
  ')',
  '',
  'func main() {',
  '\tbody := strings.NewReader("{\\"name\\":\\"Ada\\"}")',
  '\treq, err := http.NewRequest("POST", "https://api.example.com/items", body)',
  '\tif err != nil {',
  '\t\tpanic(err)',
  '\t}',
  '\treq.Header.Add("Content-Type", "application/json")',
  '\tclient := &http.Client{',
  '\t\tCheckRedirect: func(req *http.Request, via []*http.Request) error {',
  '\t\t\treturn http.ErrUseLastResponse',
  '\t\t},',
  '\t}',
  '\tresp, err := client.Do(req)',
  '\tif err != nil {',
  '\t\tpanic(err)',
  '\t}',
  '\tdefer resp.Body.Close()',
  '\tdata, err := io.ReadAll(resp.Body)',
  '\tif err != nil {',
  '\t\tpanic(err)',
  '\t}',
  '\tfmt.Println(resp.StatusCode)',
  '\tfmt.Println(string(data))',
  '}',
].join('\n');
const php = [
  '<?php',
  '$ch = curl_init("https://api.example.com/items");',
  'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);',
  'curl_setopt($ch, CURLOPT_POST, true);',
  'curl_setopt($ch, CURLOPT_HTTPHEADER, [',
  '    "Content-Type: application/json",',
  ']);',
  'curl_setopt($ch, CURLOPT_POSTFIELDS, "{\\"name\\":\\"Ada\\"}");',
  '$response = curl_exec($ch);',
  'if ($response === false) {',
  '    throw new RuntimeException(curl_error($ch));',
  '}',
  'echo curl_getinfo($ch, CURLINFO_RESPONSE_CODE), "\\n";',
  'echo $response;',
  'curl_close($ch);',
].join('\n');
const java = [
  'import java.net.URI;',
  'import java.net.http.HttpClient;',
  'import java.net.http.HttpRequest;',
  'import java.net.http.HttpResponse;',
  '',
  'public class Main {',
  '    public static void main(String[] args) throws Exception {',
  '        HttpClient client = HttpClient.newBuilder()',
  '            .followRedirects(HttpClient.Redirect.NEVER)',
  '            .build();',
  '        HttpRequest request = HttpRequest.newBuilder()',
  '            .uri(URI.create("https://api.example.com/items"))',
  '            .header("Content-Type", "application/json")',
  '            .method("POST", HttpRequest.BodyPublishers.ofString("{\\"name\\":\\"Ada\\"}"))',
  '            .build();',
  '        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());',
  '        System.out.println(response.statusCode());',
  '        System.out.println(response.body());',
  '    }',
  '}',
].join('\n');

describe('cURL to code renderers', () => {
  it('renders the POST sample in every language', () => {
    assert.equal(renderCurlAsCode(post, 'go').code, go);
    assert.equal(renderCurlAsCode(post, 'php').code, php);
    assert.equal(renderCurlAsCode(post, 'java').code, java);
    assert.match(renderCurlAsCode(post, 'python').code, /allow_redirects=False,\n    timeout=30,/);
    assert.equal(renderCurlAsCode(post, 'node').code, curlToFetch(post));
    assert.equal(renderCurlAsCode(post, 'python').follow, false);
  });

  it('follows redirects, handles GET, HEAD and other methods', () => {
    const get = "curl 'https://example.com/' -L";

    assert.match(renderCurlAsCode(get, 'go').code, /\tclient := &http\.Client\{\}\n/);
    assert.doesNotMatch(renderCurlAsCode(get, 'go').code, /"strings"/);

    assert.match(
      renderCurlAsCode(get, 'go').code,
      /http\.NewRequest\("GET", "https:\/\/example\.com\/", nil\)/,
    );

    assert.match(renderCurlAsCode(get, 'php').code, /CURLOPT_FOLLOWLOCATION, true/);
    assert.doesNotMatch(renderCurlAsCode(get, 'php').code, /CURLOPT_POST/);
    assert.match(renderCurlAsCode(get, 'java').code, /Redirect\.NORMAL/);
    assert.match(renderCurlAsCode(get, 'java').code, /\.GET\(\)/);
    assert.doesNotMatch(renderCurlAsCode(get, 'python').code, /allow_redirects/);

    assert.match(
      renderCurlAsCode("curl -X HEAD 'https://example.com/'", 'php').code,
      /CURLOPT_NOBODY, true/,
    );

    assert.match(
      renderCurlAsCode("curl -X DELETE 'https://example.com/x'", 'php').code,
      /CURLOPT_CUSTOMREQUEST, "DELETE"/,
    );

    assert.match(
      renderCurlAsCode("curl -X DELETE 'https://example.com/x'", 'java').code,
      /\.method\("DELETE", HttpRequest\.BodyPublishers\.noBody\(\)\)/,
    );

    assert.match(
      renderCurlAsCode("curl -X PUT 'https://example.com/x' -d a=1", 'php').code,
      /CURLOPT_CUSTOMREQUEST, "PUT"[\s\S]*CURLOPT_POSTFIELDS, "a=1"/,
    );
  });

  it('escapes strings and drops client-managed headers', () => {
    const tricky =
      "curl 'https://example.com/' -H 'Host: example.com' -H 'X-Note: a\"b' --data-raw 'O'\\''Reilly $5 \\ \"x\"\ttab'";

    assert.match(
      renderCurlAsCode(tricky, 'go').code,
      /strings\.NewReader\("O'Reilly \$5 \\\\ \\"x\\"\\ttab"\)/,
    );

    assert.match(
      renderCurlAsCode(tricky, 'php').code,
      /CURLOPT_POSTFIELDS, "O'Reilly \\\$5 \\\\ \\"x\\"\\ttab"/,
    );

    assert.match(
      renderCurlAsCode(tricky, 'java').code,
      /ofString\("O'Reilly \$5 \\\\ \\"x\\"\\ttab"\)/,
    );

    assert.match(
      renderCurlAsCode(tricky, 'go').code,
      /\t\/\/ Dropped headers the client sets itself: Host\n/,
    );

    assert.doesNotMatch(renderCurlAsCode(tricky, 'go').code, /Header\.Add\("Host"/);

    assert.match(
      renderCurlAsCode(tricky, 'php').code,
      /\/\/ Dropped headers the client sets itself: Host\n/,
    );

    assert.match(
      renderCurlAsCode(tricky, 'java').code,
      /        \/\/ Dropped headers the client sets itself: Host\n/,
    );

    assert.match(renderCurlAsCode(tricky, 'java').code, /\.header\("X-Note", "a\\"b"\)/);

    assert.match(
      renderCurlAsCode(tricky, 'python').code,
      /^import requests\n\n# Dropped headers the client sets itself: Host\nresponse = requests\.request\(/,
    );

    assert.equal(renderCurlAsCode(tricky, 'python').renderedHeaders, 2);

    assert.throws(
      () => renderCurlAsCode(post, 'rust'),
      /Language must be python, node, go, php or java\./,
    );

    assert.throws(() => renderCurlAsCode('wget https://x', 'go'), /curl command/);
  });
});
