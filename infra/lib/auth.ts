import { CfnOutput, Duration, Fn, RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  AccountRecovery,
  CfnManagedLoginBranding,
  ManagedLoginVersion,
  OAuthScope,
  UserPool,
  type UserPoolClient,
} from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthProps {
  /** URLs of the web app (e.g. your Vercel URL). Login redirects back to these. */
  webUrls: string[];
}

/**
 * Cognito user pool with AWS's managed login page. Sign-up is off: create users in the
 * Cognito console. The web app uses the authorization code flow with PKCE.
 */
export class Auth extends Construct {
  readonly userPool: UserPool;
  readonly client: UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthProps) {
    super(scope, id);

    this.userPool = new UserPool(this, 'UserPool', {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      passwordPolicy: { minLength: 12 },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const redirectUrls = [...props.webUrls, 'http://localhost:5173'].map((url) =>
      url.replace(/\/$/, ''),
    );

    this.client = this.userPool.addClient('WebClient', {
      generateSecret: false, // browser and mobile apps can't keep a secret; PKCE instead
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE],
        callbackUrls: redirectUrls,
        logoutUrls: redirectUrls,
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
    });

    // Domain prefixes are global per region, so derive a stable suffix from the stack's
    // unique ID rather than the account ID.
    const stackGuid = Fn.select(2, Fn.split('/', Stack.of(this).stackId));
    const domainPrefix = Fn.join('-', ['puzzle-log', Fn.select(0, Fn.split('-', stackGuid))]);

    const domain = this.userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix },
      managedLoginVersion: ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });

    // The newer managed login needs a style; use Cognito's default look.
    const branding = new CfnManagedLoginBranding(this, 'LoginBranding', {
      userPoolId: this.userPool.userPoolId,
      clientId: this.client.userPoolClientId,
      useCognitoProvidedValues: true,
    });
    branding.node.addDependency(domain);

    const authority = `https://cognito-idp.${Stack.of(this).region}.amazonaws.com/${this.userPool.userPoolId}`;
    new CfnOutput(Stack.of(this), 'CognitoAuthority', {
      value: authority,
      description: 'Set as VITE_COGNITO_AUTHORITY in Vercel',
    });
    new CfnOutput(Stack.of(this), 'CognitoClientId', {
      value: this.client.userPoolClientId,
      description: 'Set as VITE_COGNITO_CLIENT_ID in Vercel',
    });
    new CfnOutput(Stack.of(this), 'CognitoDomain', {
      value: domain.baseUrl(),
      description: 'Set as VITE_COGNITO_DOMAIN in Vercel',
    });
    new CfnOutput(Stack.of(this), 'UserPoolId', { value: this.userPool.userPoolId });
  }
}
