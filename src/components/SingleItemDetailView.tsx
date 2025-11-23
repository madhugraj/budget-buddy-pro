import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { Progress } from '@/components/ui/progress';

interface ItemDetail {
  item_name: string;
  budget: number;
  actual: number;
  utilization: number;
  category: string;
  committee: string;
}

interface SingleItemDetailViewProps {
  items: ItemDetail[];
}

export function SingleItemDetailView({ items }: SingleItemDetailViewProps) {
  const [selectedItem, setSelectedItem] = useState<string>('');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const currentItem = items.find(item => item.item_name === selectedItem);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Item Detail View</CardTitle>
        <CardDescription>Select an item to view its Budget vs Actual breakdown</CardDescription>
        <Select value={selectedItem} onValueChange={setSelectedItem}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select an item" />
          </SelectTrigger>
          <SelectContent>
            {items.map(item => (
              <SelectItem key={item.item_name} value={item.item_name}>
                {item.item_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {currentItem ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Category</p>
                <p className="text-base font-medium">{currentItem.category}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Committee</p>
                <p className="text-base font-medium">{currentItem.committee}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Budget</span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(currentItem.budget)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Actual Spent</span>
                <span className="text-lg font-bold text-accent">
                  {formatCurrency(currentItem.actual)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Variance</span>
                <span className={`text-lg font-bold ${
                  currentItem.budget - currentItem.actual >= 0 
                    ? 'text-success' 
                    : 'text-destructive'
                }`}>
                  {formatCurrency(Math.abs(currentItem.budget - currentItem.actual))}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Budget Utilization</span>
                  <span className={`text-sm font-bold ${
                    currentItem.utilization > 100 
                      ? 'text-destructive' 
                      : currentItem.utilization > 80 
                      ? 'text-warning' 
                      : 'text-success'
                  }`}>
                    {currentItem.utilization.toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={Math.min(currentItem.utilization, 100)} 
                  className="h-3"
                />
                {currentItem.utilization > 100 && (
                  <p className="text-xs text-destructive font-medium">
                    ⚠ Over budget by {(currentItem.utilization - 100).toFixed(1)}%
                  </p>
                )}
              </div>

              <div className={`p-4 rounded-lg border ${
                currentItem.budget - currentItem.actual >= 0 
                  ? 'bg-success/10 border-success/20' 
                  : 'bg-destructive/10 border-destructive/20'
              }`}>
                <p className={`text-sm font-semibold ${
                  currentItem.budget - currentItem.actual >= 0 
                    ? 'text-success' 
                    : 'text-destructive'
                }`}>
                  {currentItem.budget - currentItem.actual >= 0 
                    ? '✓ Within Budget' 
                    : '⚠ Over Budget'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <p>Select an item to view details</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}