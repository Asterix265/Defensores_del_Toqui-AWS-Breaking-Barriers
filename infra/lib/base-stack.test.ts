import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { BaseStack } from './base-stack.js';

describe('BaseStack', () => {
  it('sintetiza sin recursos en la base técnica', () => {
    const stack = new BaseStack(new App(), 'Test', { env: { region: 'us-east-1' } });
    const template = Template.fromStack(stack).toJSON() as { Resources?: Record<string, unknown> };
    expect(Object.keys(template.Resources ?? {})).toHaveLength(0);
  });
});
