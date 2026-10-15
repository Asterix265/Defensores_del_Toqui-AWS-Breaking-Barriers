import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, it } from 'vitest';
import { DevStack, ORIGEN_WEB_LOCAL, PATRON_RUT } from './dev-stack.js';

describe('DevStack', () => {
  let template: Template;

  beforeAll(() => {
    const stack = new DevStack(new App(), 'Test', {
      env: { account: '111111111111', region: 'us-east-1' },
    });
    template = Template.fromStack(stack);
  });

  it('crea un bucket privado, cifrado, con borrado a 7 días y CORS para la web local', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'toqui-dev-capturas-111111111111',
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      LifecycleConfiguration: {
        Rules: [Match.objectLike({ ExpirationInDays: 7, Status: 'Enabled' })],
      },
      CorsConfiguration: {
        CorsRules: [Match.objectLike({ AllowedOrigins: [ORIGEN_WEB_LOCAL] })],
      },
    });
  });

  it('crea el pool con atributo de jardín, sin registro abierto y con dos grupos', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
      Schema: Match.arrayWith([Match.objectLike({ Name: 'id_jardin', Mutable: true })]),
    });
    template.resourceCountIs('AWS::Cognito::UserPoolGroup', 2);
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', { GenerateSecret: false });
  });

  it('crea el guardrail que anonimiza RUT', () => {
    template.hasResourceProperties('AWS::Bedrock::Guardrail', {
      SensitiveInformationPolicyConfig: Match.objectLike({
        RegexesConfig: [
          Match.objectLike({
            Pattern: PATRON_RUT,
            InputAction: 'ANONYMIZE',
            OutputAction: 'ANONYMIZE',
          }),
        ],
      }),
    });
    template.resourceCountIs('AWS::Bedrock::GuardrailVersion', 1);
  });
});
