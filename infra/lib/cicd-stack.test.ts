import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { CiCdStack, ROL_DESPLIEGUE } from './cicd-stack.js';

describe('stack de despliegue continuo', () => {
  let plantilla: Template;

  beforeAll(() => {
    const app = new App();
    const stack = new CiCdStack(app, 'CiCd', {
      env: { account: '111111111111', region: 'us-east-1' },
    });
    plantilla = Template.fromStack(stack);
  });

  it('crea el proveedor OIDC de GitHub como recurso nativo', () => {
    plantilla.hasResourceProperties('AWS::IAM::OIDCProvider', {
      Url: 'https://token.actions.githubusercontent.com',
      ClientIdList: ['sts.amazonaws.com'],
    });
    // Sin custom resource (OpenIdConnectProvider usaría una Lambda).
    plantilla.resourceCountIs('AWS::Lambda::Function', 0);
  });

  it('solo la rama main del repositorio puede asumir el rol', () => {
    plantilla.hasResourceProperties('AWS::IAM::Role', {
      RoleName: ROL_DESPLIEGUE,
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Action: 'sts:AssumeRoleWithWebIdentity',
            Condition: {
              StringEquals: {
                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                // `sub` inmutable: con los ids del dueño y del repositorio.
                'token.actions.githubusercontent.com:sub':
                  'repo:Asterix265@94083287/Defensores_del_Toqui-AWS-Breaking-Barriers@1419528574:ref:refs/heads/main',
              },
            },
          }),
        ],
      },
    });
  });

  it('no tiene políticas administradas ni comodines de acción', () => {
    const [rol] = Object.values(plantilla.findResources('AWS::IAM::Role'));
    expect(rol?.Properties.ManagedPolicyArns).toBeUndefined();
    const acciones = Object.values(plantilla.findResources('AWS::IAM::Policy')).flatMap((p) =>
      (p.Properties.PolicyDocument.Statement as { Action: string | string[] }[]).flatMap((s) =>
        ([] as string[]).concat(s.Action),
      ),
    );
    expect(acciones.length).toBeGreaterThan(0);
    expect(acciones.filter((a) => a.includes('*'))).toEqual([]);
  });

  it('asume solo los roles del bootstrap de CDK', () => {
    plantilla.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ['sts:AssumeRole', 'sts:TagSession'],
            Resource: Match.arrayWith([
              Match.objectLike({
                'Fn::Join': Match.arrayWith([
                  Match.arrayWith([
                    Match.stringLikeRegexp('role/cdk-hnb659fds-deploy-role-111111111111'),
                  ]),
                ]),
              }),
            ]),
          }),
        ]),
      },
    });
  });
});
