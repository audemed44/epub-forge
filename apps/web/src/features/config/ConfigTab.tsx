import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CustomThemeConfig, ThemeId } from "./theme";
import { themeOptions } from "./theme";

type ConfigTabProps = {
  theme: ThemeId;
  setTheme: (value: ThemeId) => void;
  customTheme: CustomThemeConfig;
  onCustomThemeChange: <K extends keyof CustomThemeConfig>(key: K, value: CustomThemeConfig[K]) => void;
  onResetCustomTheme: () => void;
};

function ColorField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <div className="grid grid-cols-[50px_1fr] gap-2">
        <input
          id={props.id}
          type="color"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          className="h-11 w-full cursor-pointer rounded-base border-2 border-border bg-secondary-background"
        />
        <Input value={props.value} onChange={(event) => props.onChange(event.target.value)} />
      </div>
    </div>
  );
}

export function ConfigTab(props: ConfigTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[2rem] md:text-[2.15rem]">Configuration</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2 md:max-w-md">
          <Label htmlFor="theme-preset">Theme preset</Label>
          <Select value={props.theme} onValueChange={(value) => props.setTheme(value as ThemeId)}>
            <SelectTrigger id="theme-preset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {themeOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-foreground/70">Switch to Custom to design your own palette and border/shadow settings.</p>
        </div>

        {props.theme === "custom" ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-heading">Custom Theme</h3>
              <Button type="button" variant="neutral" onClick={props.onResetCustomTheme}>
                Reset to Default
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <ColorField
                id="custom-bg-start"
                label="Background gradient start"
                value={props.customTheme.backgroundStartHex}
                onChange={(value) => props.onCustomThemeChange("backgroundStartHex", value)}
              />
              <ColorField
                id="custom-bg-end"
                label="Background gradient end"
                value={props.customTheme.backgroundEndHex}
                onChange={(value) => props.onCustomThemeChange("backgroundEndHex", value)}
              />
              <ColorField
                id="custom-background"
                label="Background color"
                value={props.customTheme.colorBackgroundHex}
                onChange={(value) => props.onCustomThemeChange("colorBackgroundHex", value)}
              />
              <ColorField
                id="custom-surface"
                label="Surface color"
                value={props.customTheme.colorSurfaceHex}
                onChange={(value) => props.onCustomThemeChange("colorSurfaceHex", value)}
              />
              <ColorField
                id="custom-foreground"
                label="Foreground color"
                value={props.customTheme.colorForegroundHex}
                onChange={(value) => props.onCustomThemeChange("colorForegroundHex", value)}
              />
              <ColorField
                id="custom-accent"
                label="Accent color"
                value={props.customTheme.colorAccentHex}
                onChange={(value) => props.onCustomThemeChange("colorAccentHex", value)}
              />
              <ColorField
                id="custom-accent-foreground"
                label="Accent foreground"
                value={props.customTheme.colorAccentForegroundHex}
                onChange={(value) => props.onCustomThemeChange("colorAccentForegroundHex", value)}
              />
              <ColorField
                id="custom-border"
                label="Border color"
                value={props.customTheme.colorBorderHex}
                onChange={(value) => props.onCustomThemeChange("colorBorderHex", value)}
              />
              <ColorField
                id="custom-ring"
                label="Focus ring color"
                value={props.customTheme.colorRingHex}
                onChange={(value) => props.onCustomThemeChange("colorRingHex", value)}
              />
              <ColorField
                id="custom-terminal-bg"
                label="Log panel background"
                value={props.customTheme.terminalBackgroundHex}
                onChange={(value) => props.onCustomThemeChange("terminalBackgroundHex", value)}
              />
              <ColorField
                id="custom-terminal-fg"
                label="Log panel text"
                value={props.customTheme.terminalForegroundHex}
                onChange={(value) => props.onCustomThemeChange("terminalForegroundHex", value)}
              />
              <div className="grid gap-2">
                <Label htmlFor="custom-shadow-x">Shadow X (px)</Label>
                <Input
                  id="custom-shadow-x"
                  value={props.customTheme.shadowX}
                  onChange={(event) => props.onCustomThemeChange("shadowX", event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="custom-shadow-y">Shadow Y (px)</Label>
                <Input
                  id="custom-shadow-y"
                  value={props.customTheme.shadowY}
                  onChange={(event) => props.onCustomThemeChange("shadowY", event.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="custom-hide-borders"
                checked={props.customTheme.hideBorders}
                onCheckedChange={(checked) => props.onCustomThemeChange("hideBorders", checked === true)}
              />
              <Label htmlFor="custom-hide-borders">Hide borders</Label>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
