import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Key, CheckCircle2, Eye, EyeOff } from "lucide-react";

const PROVIDERS = [
  { value: "together",  label: "Together AI",  placeholder: "your-together-api-key", url: "https://api.together.xyz/settings/api-keys",  model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo" },
  { value: "openai",    label: "OpenAI",        placeholder: "sk-...",                url: "https://platform.openai.com/api-keys",         model: "gpt-4o-mini" },
  { value: "deepseek",  label: "DeepSeek",      placeholder: "your-deepseek-api-key", url: "https://platform.deepseek.com/api_keys",       model: "deepseek-chat" },
  { value: "fireworks", label: "Fireworks AI",  placeholder: "your-fireworks-api-key",url: "https://fireworks.ai/account/api-keys",        model: "accounts/fireworks/models/llama-v3p1-8b-instruct" },
];

export default function Settings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("together");
  const [model, setModel] = useState("");
  const [showKey, setShowKey] = useState(false);

  const { data: current } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("GET", "/api/settings").then(r => r.json()),
  });

  useEffect(() => {
    if (current) {
      setProvider(current.provider || "together");
      setModel(current.model || "");
    }
  }, [current]);

  const save = useMutation({
    mutationFn: () => apiRequest("POST", "/api/settings", {
      apiKey: apiKey || undefined,
      provider,
      model: model || undefined,
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ description: "Settings saved" });
      setApiKey("");
    },
  });

  const selectedProvider = PROVIDERS.find(p => p.value === provider) || PROVIDERS[0];

  return (
    <div className="px-8 py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-muted-foreground" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your AI provider for the copy generator</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Key className="h-4 w-4" /> AI Provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {current?.hasKey && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-signal/10 border border-signal/30">
              <CheckCircle2 className="h-3.5 w-3.5 text-signal" />
              <p className="text-xs text-signal font-medium">API key is configured · {current.provider}</p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Provider</label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger data-testid="select-provider" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Get your key at{" "}
              <a href={selectedProvider.url} target="_blank" rel="noopener noreferrer" className="text-signal hover:underline">
                {selectedProvider.url.replace("https://", "")}
              </a>
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              API Key {current?.hasKey ? "(leave blank to keep existing)" : ""}
            </label>
            <div className="relative">
              <Input
                data-testid="input-api-key"
                type={showKey ? "text" : "password"}
                placeholder={selectedProvider.placeholder}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="pr-10 font-mono text-sm h-9"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Model Override <span className="font-normal">(optional — leave blank for default)</span>
            </label>
            <Input
              data-testid="input-model"
              placeholder={selectedProvider.model}
              value={model}
              onChange={e => setModel(e.target.value)}
              className="font-mono text-sm h-9"
            />
          </div>

          <Button
            data-testid="button-save-settings"
            className="bg-signal hover:bg-signal/90 text-[hsl(214,35%,8%)] font-semibold w-full"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
