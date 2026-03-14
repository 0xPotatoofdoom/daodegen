import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseSermonResponse,
  sanitizeInput,
  loadSoul,
  buildPastorPrompt,
  StubLLMProvider,
  AnthropicLLMProvider,
  type SermonRequest,
} from './llm';
import { verses } from './verses';

describe('parseSermonResponse - fallback parser', () => {
  it('extracts verse_references from invalid JSON with regex', () => {
    // Text that is NOT valid JSON but contains a verse_references pattern
    const text = 'The oracle speaks: "verse_references": [3, 17, 42] and more text';
    const result = parseSermonResponse(text);

    expect(result.verse_references).toEqual([3, 17, 42]);
    expect(result.response_type).toBe('full');
    expect(result.sentiment_tag).toBe('seeking');
    expect(result.content).toBe(text);
  });

  it('clamps extracted verse references to 1-81', () => {
    const text = 'broken json "verse_references": [0, 99, 50]';
    const result = parseSermonResponse(text);

    expect(result.verse_references).toEqual([1, 81, 50]);
  });

  it('defaults to [1] when fallback regex finds no verse_references', () => {
    const text = 'completely unstructured garbage';
    const result = parseSermonResponse(text);

    expect(result.verse_references).toEqual([1]);
  });

  it('defaults to [1] when verse_references array is empty in regex', () => {
    const text = 'broken "verse_references": [] end';
    const result = parseSermonResponse(text);

    // Empty array after parsing results in empty refs, which then defaults to [1]
    expect(result.verse_references).toEqual([1]);
  });

  it('handles valid JSON with missing verse_references', () => {
    const json = JSON.stringify({
      content: 'test',
      sentiment_tag: 'peaceful',
      response_type: 'sparse',
    });
    const result = parseSermonResponse(json);

    // verse_references defaults to [1] when missing
    expect(result.verse_references).toEqual([1]);
    expect(result.response_type).toBe('sparse');
  });

  it('handles valid JSON with null content', () => {
    const json = JSON.stringify({
      content: null,
      verse_references: [5],
      sentiment_tag: 'seeking',
      response_type: 'full',
    });
    const result = parseSermonResponse(json);

    expect(result.content).toBe('');
  });

  it('truncates very long content to MAX_SERMON_LENGTH', () => {
    const longContent = 'x'.repeat(5000);
    const json = JSON.stringify({
      content: longContent,
      verse_references: [1],
      sentiment_tag: 'seeking',
      response_type: 'full',
    });
    const result = parseSermonResponse(json);

    expect(result.content.length).toBe(4096);
  });

  it('validates all response_type values', () => {
    for (const type of ['full', 'sparse', 'verse_only', 'silence']) {
      const json = JSON.stringify({
        content: 'test',
        verse_references: [1],
        sentiment_tag: 'seeking',
        response_type: type,
      });
      const result = parseSermonResponse(json);
      expect(result.response_type).toBe(type);
    }
  });

  it('defaults invalid sentiment_tag to seeking', () => {
    const json = JSON.stringify({
      content: 'test',
      verse_references: [1],
      sentiment_tag: 'invalid_mood',
      response_type: 'full',
    });
    const result = parseSermonResponse(json);

    expect(result.sentiment_tag).toBe('seeking');
  });

  it('accepts all valid sentiment tags', () => {
    const validTags = [
      'seeking', 'grieving', 'grateful', 'confused',
      'proud', 'letting_go', 'peaceful', 'restless',
    ];
    for (const tag of validTags) {
      const json = JSON.stringify({
        content: 'test',
        verse_references: [1],
        sentiment_tag: tag,
        response_type: 'full',
      });
      const result = parseSermonResponse(json);
      expect(result.sentiment_tag).toBe(tag);
    }
  });
});

describe('loadSoul', () => {
  it('returns cached content on second call', () => {
    const first = loadSoul();
    const second = loadSoul();
    expect(first).toBe(second); // Same reference (cached)
  });
});

describe('buildPastorPrompt - sanitization', () => {
  it('sanitizes congregation state input', () => {
    const malicious = 'x'.repeat(1000) + '<script>alert("xss")</script>';
    const prompt = buildPastorPrompt(verses, malicious);

    // State should be truncated to MAX_STATE_LENGTH (500)
    expect(prompt).toContain('Current Congregation State');
    // The full malicious string should not appear (it's > 500 chars)
    expect(prompt).not.toContain('<script>');
  });
});

describe('StubLLMProvider', () => {
  const provider = new StubLLMProvider();

  it('generateInterpretation returns stub marker', async () => {
    const result = await provider.generateInterpretation(verses[0]);
    expect(result).toContain('[STUB]');
    expect(result).toContain('Verse 1');
    expect(result).toContain(verses[0].title);
  });

  it('generateCommentary includes context', async () => {
    const result = await provider.generateCommentary(verses[0], 'providing liquidity');
    expect(result).toContain('[STUB]');
    expect(result).toContain('providing liquidity');
  });

  it('generateOracleReading selects verse deterministically', async () => {
    const result = await provider.generateOracleReading(verses, 'test state');
    expect(result.verseId).toBeGreaterThanOrEqual(1);
    expect(result.verseId).toBeLessThanOrEqual(81);
    expect(result.reading).toContain('[STUB]');
    expect(result.reasoning).toContain('[STUB]');
  });

  it('generateSermon with message returns full response', async () => {
    const request: SermonRequest = {
      message: 'I seek wisdom',
      sender: '0x1234',
      prayerType: 'prayer',
      burnAmount: '100',
    };
    const result = await provider.generateSermon(verses, request);
    expect(result.response_type).toBe('full');
    expect(result.content).toContain('[STUB]');
    expect(result.verse_references.length).toBeGreaterThanOrEqual(1);
  });

  it('generateSermon with empty message returns silence', async () => {
    const request: SermonRequest = {
      message: '',
      sender: '0x1234',
      prayerType: 'silent',
      burnAmount: '500',
    };
    const result = await provider.generateSermon(verses, request);
    expect(result.response_type).toBe('silence');
    expect(result.content).toBe('');
  });
});

describe('AnthropicLLMProvider', () => {
  const mockCreate = vi.fn();

  async function getProvider() {
    vi.resetModules();
    vi.doMock('@anthropic-ai/sdk', () => ({
      default: class MockAnthropic {
        messages = { create: mockCreate };
      },
    }));
    const { AnthropicLLMProvider: Provider } = await import('./llm');
    return new Provider('test-api-key');
  }

  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('generateInterpretation calls Anthropic API', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'The way that can be named...' }],
    });

    const provider = await getProvider();
    const result = await provider.generateInterpretation(verses[0]);

    expect(result).toBe('The way that can be named...');
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 512,
      }),
    );
  });

  it('generateCommentary calls API with context', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Regarding your liquidity...' }],
    });

    const provider = await getProvider();
    const result = await provider.generateCommentary(verses[0], 'providing liquidity');

    expect(result).toBe('Regarding your liquidity...');
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('generateOracleReading parses JSON response', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          verse_id: 42,
          reading: 'The oracle speaks',
          reasoning: 'This verse fits',
        }),
      }],
    });

    const provider = await getProvider();
    const result = await provider.generateOracleReading(verses, 'I hold ETH');

    expect(result.verseId).toBe(42);
    expect(result.reading).toBe('The oracle speaks');
    expect(result.reasoning).toBe('This verse fits');
  });

  it('generateOracleReading handles non-JSON response with fallback', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'The oracle speaks without JSON "verse_id": 7' }],
    });

    const provider = await getProvider();
    const result = await provider.generateOracleReading(verses, 'test state');

    expect(result.verseId).toBe(7);
    expect(result.reading).toContain('oracle speaks');
    expect(result.reasoning).toBe('The oracle has spoken.');
  });

  it('generateOracleReading defaults to verse 1 when no ID found', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Just plain text' }],
    });

    const provider = await getProvider();
    const result = await provider.generateOracleReading(verses, 'state');

    expect(result.verseId).toBe(1);
  });

  it('generateSermon calls API and parses response', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          content: 'The pool remembers your sacrifice.',
          verse_references: [4, 8],
          sentiment_tag: 'peaceful',
          response_type: 'full',
        }),
      }],
    });

    const provider = await getProvider();
    const result = await provider.generateSermon(verses, {
      message: 'I lost it all',
      sender: '0xabc',
      prayerType: 'prayer',
      burnAmount: '100',
    });

    expect(result.content).toBe('The pool remembers your sacrifice.');
    expect(result.verse_references).toEqual([4, 8]);
    expect(result.sentiment_tag).toBe('peaceful');
    expect(result.response_type).toBe('full');
  });

  it('generateSermon handles silent prayer', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          content: '',
          verse_references: [6],
          sentiment_tag: 'peaceful',
          response_type: 'silence',
        }),
      }],
    });

    const provider = await getProvider();
    const result = await provider.generateSermon(verses, {
      message: '',
      sender: '0xabc',
      prayerType: 'silent',
      burnAmount: '50',
    });

    expect(result.response_type).toBe('silence');
    expect(result.content).toBe('');
  });
});

describe('createProvider factory', () => {
  it('creates AnthropicLLMProvider when API key is set', async () => {
    vi.resetModules();
    vi.doMock('@anthropic-ai/sdk', () => ({
      default: class MockAnthropic {
        messages = { create: vi.fn() };
      },
    }));

    const origKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';

    const { llm, AnthropicLLMProvider } = await import('./llm');
    expect(llm).toBeInstanceOf(AnthropicLLMProvider);

    process.env.ANTHROPIC_API_KEY = origKey;
  });

  it('creates StubLLMProvider when no API key', async () => {
    vi.resetModules();
    const origKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const { llm, StubLLMProvider } = await import('./llm');
    expect(llm).toBeInstanceOf(StubLLMProvider);

    process.env.ANTHROPIC_API_KEY = origKey;
  });
});
