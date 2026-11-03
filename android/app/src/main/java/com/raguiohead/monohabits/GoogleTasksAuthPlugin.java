package com.raguiohead.monohabits;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationClient;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "GoogleTasksAuth")
public class GoogleTasksAuthPlugin extends Plugin {

    private static final String TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";
    private static final int REQUEST_CODE_AUTHORIZE = 9821;

    private ActivityResultLauncher<IntentSenderRequest> authorizationLauncher;
    private PluginCall savedCall;

    @Override
    public void load() {
        super.load();
        try {
            authorizationLauncher = getActivity().registerForActivityResult(
                new ActivityResultContracts.StartIntentSenderForResult(),
                this::handleActivityResult
            );
        } catch (Exception e) {
            authorizationLauncher = null;
        }
    }

    @PluginMethod
    public void authorize(PluginCall call) {
        boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", false));

        if (interactive && savedCall != null) {
            call.reject("Outra autorização interativa já está em andamento.", "busy");
            return;
        }

        List<Scope> requestedScopes = Collections.singletonList(new Scope(TASKS_SCOPE));

        AuthorizationRequest authorizationRequest = AuthorizationRequest.builder()
            .setRequestedScopes(requestedScopes)
            .build();

        AuthorizationClient client = Identity.getAuthorizationClient(getActivity());

        client.authorize(authorizationRequest)
            .addOnSuccessListener(authorizationResult -> {
                if (authorizationResult.hasResolution()) {
                    if (!interactive) {
                        call.reject("Consent required", "consent_required");
                        return;
                    }

                    PendingIntent pendingIntent = authorizationResult.getPendingIntent();
                    if (pendingIntent == null) {
                        call.reject("PendingIntent para resolução ausente.", "failed");
                        return;
                    }

                    savedCall = call;
                    try {
                        IntentSenderRequest intentSenderRequest = new IntentSenderRequest.Builder(
                            pendingIntent.getIntentSender()
                        ).build();

                        if (authorizationLauncher != null) {
                            authorizationLauncher.launch(intentSenderRequest);
                        } else {
                            getActivity().startIntentSenderForResult(
                                pendingIntent.getIntentSender(),
                                REQUEST_CODE_AUTHORIZE,
                                null,
                                0,
                                0,
                                0
                            );
                        }
                    } catch (Exception e) {
                        savedCall = null;
                        call.reject("Falha ao abrir tela de autorização: " + e.getMessage(), "failed", e);
                    }
                } else {
                    String accessToken = authorizationResult.getAccessToken();
                    if (accessToken == null || accessToken.isEmpty()) {
                        call.reject("Google não retornou accessToken.", "failed");
                        return;
                    }
                    JSObject ret = new JSObject();
                    ret.put("accessToken", accessToken);
                    call.resolve(ret);
                }
            })
            .addOnFailureListener(e -> {
                if (e instanceof ApiException) {
                    ApiException apiException = (ApiException) e;
                    call.reject(
                        apiException.getMessage() != null ? apiException.getMessage() : "Erro na API de autorização.",
                        String.valueOf(apiException.getStatusCode()),
                        apiException
                    );
                } else {
                    call.reject(
                        e.getMessage() != null ? e.getMessage() : "Falha ao solicitar autorização.",
                        "failed",
                        e
                    );
                }
            });
    }

    private void handleActivityResult(ActivityResult result) {
        if (savedCall == null) {
            return;
        }
        PluginCall call = savedCall;
        savedCall = null;

        if (result.getResultCode() == Activity.RESULT_OK) {
            Intent intent = result.getData();
            try {
                AuthorizationResult authorizationResult = Identity.getAuthorizationClient(getActivity())
                    .getAuthorizationResultFromIntent(intent);
                String accessToken = authorizationResult.getAccessToken();
                if (accessToken == null || accessToken.isEmpty()) {
                    call.reject("Google não retornou accessToken após consentimento.", "failed");
                    return;
                }
                JSObject ret = new JSObject();
                ret.put("accessToken", accessToken);
                call.resolve(ret);
            } catch (ApiException e) {
                call.reject(
                    e.getMessage() != null ? e.getMessage() : "Erro na API após consentimento.",
                    String.valueOf(e.getStatusCode()),
                    e
                );
            } catch (Exception e) {
                call.reject(
                    e.getMessage() != null ? e.getMessage() : "Falha ao processar resposta de autorização.",
                    "failed",
                    e
                );
            }
        } else {
            call.reject("Autorização cancelada pelo usuário.", "canceled");
        }
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_CODE_AUTHORIZE) {
            handleActivityResult(new ActivityResult(resultCode, data));
        }
    }
}
